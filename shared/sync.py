#!/usr/bin/env python3
"""
Metis Model Sync Tool

Generates Pydantic models from JSON Schema definitions to keep shared models
consistent across MedEd platform projects.

Usage:
    python sync.py --project all      # Generate for all projects
    python sync.py --project oread    # Generate for specific project
    python sync.py --validate         # Check if models are in sync
    python sync.py --dry-run          # Show what would be generated
"""

import argparse
import difflib
import json
import keyword
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Project configurations - which models each project needs
PROJECTS = {
  "oread": {
    "path": "../../synpat/src/models/_generated",
    "models": ["CodeableConcept", "Condition", "Medication", "Allergy", "PatientContext"]
  },
  "syrinx": {
    "path": "../../synvoice/models/_generated",
    "models": ["CodeableConcept", "Condition", "Medication", "Allergy",
               "PatientContext", "EncounterContext", "ScriptLine", "InjectedError"]
  },
  "mneme": {
    "path": "../../synchart/backend/src/models/_generated",
    "models": ["CodeableConcept", "Condition", "Medication", "Allergy", "PatientContext"]
  },
  "echo": {
    "path": "../../echo/src/models/_generated",
    "models": ["CodeableConcept", "Condition", "Medication", "Allergy",
               "PatientContext", "EncounterContext", "EncounterSummary",
               "ScriptLine", "InjectedError"]
  }
}

# Type mappings from JSON Schema to Python
TYPE_MAP = {
  "string": "str",
  "integer": "int",
  "number": "float",
  "boolean": "bool",
  "array": "list",
  "object": "dict",
}

GENERATED_AT_RE = re.compile(r"^Generated at: .*$", re.MULTILINE)


def load_schemas(schemas_dir: Path) -> dict[str, dict]:
  """Load all JSON schemas from directory and merge definitions."""
  all_definitions = {}

  for schema_file in schemas_dir.glob("*.schema.json"):
    with open(schema_file) as f:
      schema = json.load(f)
      definitions = schema.get("definitions", {})
      all_definitions.update(definitions)

  return all_definitions


def validate_python_identifier(name: str, context: str) -> None:
  """Ensure a schema name can be emitted as a Python identifier."""
  if not name.isidentifier() or keyword.iskeyword(name):
    raise ValueError(f"Unsafe Python identifier for {context}: {name!r}")


def validate_generated_text(text: str, context: str, *, allow_newline: bool = False) -> None:
  """Reject text that can break generated Python comments or docstrings."""
  if '"""' in text:
    raise ValueError(f"Unsafe triple-quote sequence in {context}")
  if "\r" in text:
    raise ValueError(f"Unsafe carriage return in {context}")
  if not allow_newline and "\n" in text:
    raise ValueError(f"Unsafe newline in {context}")


def literal_values(values: list[Any]) -> str:
  """Render Python Literal string values safely."""
  return ", ".join(repr(value) for value in values)


def normalize_generated_content(content: str) -> str:
  """Remove intentionally volatile fields before comparing generated files."""
  return GENERATED_AT_RE.sub("Generated at: <normalized>", content).strip() + "\n"


def resolve_ref(ref: str, definitions: dict) -> str:
  """Resolve a $ref to get the type name."""
  # Handle both local and cross-file references
  # "#/definitions/CodeableConcept" -> "CodeableConcept"
  # "clinical.schema.json#/definitions/Condition" -> "Condition"
  if "#/definitions/" in ref:
    name = ref.split("#/definitions/")[-1]
    validate_python_identifier(name, f"$ref {ref}")
    return name
  return "Any"


def get_dependencies(definition: dict, definitions: dict) -> set[str]:
  """Get all type dependencies for a definition."""
  deps = set()

  def scan_for_refs(obj: Any):
    if isinstance(obj, dict):
      if "$ref" in obj:
        dep = resolve_ref(obj["$ref"], definitions)
        if dep in definitions:
          deps.add(dep)
      for v in obj.values():
        scan_for_refs(v)
    elif isinstance(obj, list):
      for item in obj:
        scan_for_refs(item)

  scan_for_refs(definition)
  return deps


def topological_sort(definitions: dict, requested: list[str]) -> list[str]:
  """Sort definitions so dependencies come before dependents."""
  # Build dependency graph for requested models
  graph = {}
  all_needed = []
  seen = set()

  def add_needed(name: str) -> None:
    if name not in seen:
      seen.add(name)
      all_needed.append(name)

  # Find all transitive dependencies
  to_process = []
  for name in requested:
    add_needed(name)
    to_process.append(name)

  while to_process:
    name = to_process.pop(0)
    if name not in definitions:
      continue
    deps = set(sorted(get_dependencies(definitions[name], definitions)))
    graph[name] = deps
    for dep in sorted(deps):
      if dep not in seen:
        add_needed(dep)
        to_process.append(dep)

  # Topological sort using Kahn's algorithm
  in_degree = {name: 0 for name in all_needed}
  for name in all_needed:
    for dep in graph.get(name, set()):
      if dep in in_degree:
        in_degree[name] += 1

  queue = [name for name in all_needed if in_degree[name] == 0]
  result = []

  while queue:
    name = queue.pop(0)
    result.append(name)
    for other in all_needed:
      if name in graph.get(other, set()):
        in_degree[other] -= 1
        if in_degree[other] == 0:
          queue.append(other)

  return result


def json_type_to_python(prop: dict, definitions: dict) -> str:
  """Convert JSON Schema type to Python type hint."""
  if "$ref" in prop:
    return resolve_ref(prop["$ref"], definitions)

  json_type = prop.get("type", "Any")

  if json_type == "array":
    items = prop.get("items", {})
    item_type = json_type_to_python(items, definitions)
    return f"list[{item_type}]"

  if json_type == "string":
    if prop.get("format") == "date":
      return "date"
    if "enum" in prop:
      return f"Literal[{literal_values(prop['enum'])}]"
    if "const" in prop:
      return f"Literal[{repr(prop['const'])}]"

  return TYPE_MAP.get(json_type, "Any")


def generate_enum_alias(name: str, definition: dict) -> str | None:
  """Generate a type alias for enum types."""
  validate_python_identifier(name, "enum alias")
  if definition.get("type") == "string" and "enum" in definition:
    values = literal_values(definition["enum"])
    desc = definition.get("description", "")
    if desc:
      validate_generated_text(desc, f"{name} description")
      return f'# {desc}\n{name} = Literal[{values}]'
    return f'{name} = Literal[{values}]'
  return None


def generate_model_code(name: str, definition: dict, definitions: dict) -> str:
  """Generate Pydantic model code from JSON Schema definition."""
  validate_python_identifier(name, "model")

  # Handle pure enum types as type aliases
  if definition.get("type") == "string" and "enum" in definition:
    return generate_enum_alias(name, definition)

  lines = []
  description = definition.get("description", f"{name} model")
  validate_generated_text(description, f"{name} description", allow_newline=True)
  lines.append(f'class {name}(BaseModel):')
  lines.append(f'  """{description}"""')

  required = set(definition.get("required", []))
  properties = definition.get("properties", {})

  if not properties:
    lines.append('  pass')
    return "\n".join(lines)

  for prop_name, prop_def in properties.items():
    validate_python_identifier(prop_name, f"{name}.{prop_name}")
    python_type = json_type_to_python(prop_def, definitions)
    is_required = prop_name in required

    # Handle default values
    default = prop_def.get("default")

    if is_required:
      if default is not None:
        default_str = repr(default)
        lines.append(f'  {prop_name}: {python_type} = {default_str}')
      else:
        lines.append(f'  {prop_name}: {python_type}')
    else:
      if default is not None:
        default_str = repr(default)
        lines.append(f'  {prop_name}: {python_type} | None = {default_str}')
      else:
        lines.append(f'  {prop_name}: {python_type} | None = None')

  return "\n".join(lines)


def render_file_content(project_name: str, models: list[str], definitions: dict,
                        timestamp: str | None = None) -> tuple[str, list[str]]:
  """Render generated Python model file content."""
  timestamp = timestamp or datetime.now().isoformat()
  # Sort models by dependency order
  sorted_models = topological_sort(definitions, models)

  # Header
  header = f'''"""
GENERATED BY METIS - DO NOT EDIT DIRECTLY
Generated at: {timestamp}
Project: {project_name}

Source: metis/shared/models/
To modify, edit the JSON Schema files and run: python metis/shared/sync.py
"""

from datetime import date
from typing import Literal, Any
from pydantic import BaseModel

'''

  # Generate each model
  model_codes = []
  generated_names = []

  for model_name in sorted_models:
    if model_name in definitions:
      code = generate_model_code(model_name, definitions[model_name], definitions)
      if code:  # Skip None (enum types)
        model_codes.append(code)
        generated_names.append(model_name)
    else:
      print(f"  Warning: {model_name} not found in schemas")

  content = header + "\n\n".join(model_codes) + "\n"
  return content, generated_names


def render_init_content(generated_names: list[str]) -> str:
  """Render generated package init content."""
  names = ", ".join(generated_names)
  return f'''"""Generated models from Metis sync."""
from .context import {names}

__all__ = {generated_names}
'''


def generate_file(project_name: str, models: list[str], definitions: dict,
                  output_dir: Path, dry_run: bool = False) -> str:
  """Generate Python file with all models for a project."""
  content, generated_names = render_file_content(project_name, models, definitions)

  if dry_run:
    print(f"\n--- {project_name}: {output_dir}/context.py ---")
    print(content[:1500] + "..." if len(content) > 1500 else content)
  else:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "context.py"
    with open(output_file, "w") as f:
      f.write(content)
    print(f"  Generated {output_file}")

    # Create __init__.py
    init_content = render_init_content(generated_names)
    init_file = output_dir / "__init__.py"
    with open(init_file, "w") as f:
      f.write(init_content)
    print(f"  Generated {init_file}")

  return content


def validate_sync(definitions: dict) -> bool:
  """Validate that generated files match current schemas."""
  all_valid = True

  for project_name, config in PROJECTS.items():
    output_dir = Path(__file__).parent / config["path"]
    context_file = output_dir / "context.py"

    if not context_file.exists():
      print(f"  {project_name}: MISSING - {context_file}")
      all_valid = False
      continue

    with open(context_file) as f:
      content = f.read()

    # Check for "GENERATED BY METIS" header
    if "GENERATED BY METIS" not in content:
      print(f"  {project_name}: NOT MANAGED - missing Metis header")
      all_valid = False
      continue

    expected, _generated_names = render_file_content(
      project_name,
      config["models"],
      definitions,
      timestamp="<normalized>",
    )

    actual_normalized = normalize_generated_content(content)
    expected_normalized = normalize_generated_content(expected)

    if actual_normalized != expected_normalized:
      diff = "\n".join(difflib.unified_diff(
        expected_normalized.splitlines(),
        actual_normalized.splitlines(),
        fromfile=f"expected:{project_name}/context.py",
        tofile=f"actual:{project_name}/context.py",
        lineterm="",
      ))
      print(f"  {project_name}: OUT OF SYNC")
      if diff:
        print("\n".join(f"    {line}" for line in diff.splitlines()[:40]))
      all_valid = False
    else:
      print(f"  {project_name}: OK")

  return all_valid


def sync_project(project_name: str, definitions: dict, dry_run: bool = False):
  """Sync models for a specific project."""
  config = PROJECTS[project_name]
  output_dir = Path(__file__).parent / config["path"]
  models = config["models"]

  print(f"Syncing {project_name}...")
  generate_file(project_name, models, definitions, output_dir, dry_run)


def main():
  parser = argparse.ArgumentParser(
    description="Sync MedEd shared models across projects",
    formatter_class=argparse.RawDescriptionHelpFormatter,
    epilog="""
Examples:
  python sync.py --project all      # Generate for all projects
  python sync.py --project oread    # Generate for specific project
  python sync.py --validate         # Check if models are in sync
  python sync.py --dry-run          # Preview what would be generated
    """
  )
  parser.add_argument(
    "--project",
    choices=list(PROJECTS.keys()) + ["all"],
    default="all",
    help="Project to sync (default: all)"
  )
  parser.add_argument(
    "--validate",
    action="store_true",
    help="Validate sync status without making changes"
  )
  parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Show what would be generated without writing files"
  )

  args = parser.parse_args()

  # Load schemas
  schemas_dir = Path(__file__).parent / "models"
  definitions = load_schemas(schemas_dir)

  if not definitions:
    print("Error: No definitions found in", schemas_dir)
    sys.exit(1)

  print(f"Loaded {len(definitions)} definition(s)")

  if args.validate:
    print("\nValidating sync status...")
    if validate_sync(definitions):
      print("\nAll models in sync!")
      sys.exit(0)
    else:
      print("\nModels out of sync! Run: python sync.py --project all")
      sys.exit(1)

  # Sync projects
  projects = PROJECTS.keys() if args.project == "all" else [args.project]

  for project in projects:
    sync_project(project, definitions, args.dry_run)

  if not args.dry_run:
    print("\nSync complete!")
    print("Remember to commit the generated files to each project.")


if __name__ == "__main__":
  main()
