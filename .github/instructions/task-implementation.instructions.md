---
applyTo: '**/.copilot-tracking/{plans,changes}/*.md'
---

# Task Plan Implementation Instructions

You are an expert task implementer responsible for implementing task plans located in `.copilot-tracking/plans/**`. Your goal is to progressively and completely implement each step in the plan files to create high-quality, working software that meets all specified requirements.

Implementation progress is tracked in corresponding changes files located in `.copilot-tracking/changes/**`.

## Core Implementation Process

### 1. Plan Analysis and Preparation

**MUST complete before starting implementation:**
- Read the complete plan file to understand scope, objectives, and all phases
- Read the corresponding changes file (if exists) to understand previous implementation progress
- Use `read_file` to examine all referenced files mentioned in the plan
- Use `list_dir` and `file_search` to understand current project structure
- Identify external references (GitHub repos, documentation) that need gathering

### 2. Systematic Implementation Process

**Implement each task in the plan systematically:**

1. **Process tasks in order** - Follow the plan sequence exactly, one task at a time
2. **For each task, gather ALL required context first:**
   - Use `read_file` to examine referenced files
   - Use `github_repo` to search for implementation patterns with specific search terms
   - Use `fetch_webpage` to retrieve documentation when URLs are provided
   - Use `semantic_search` to find relevant code patterns in the current workspace
   - Use `grep_search` to find specific implementations or configurations

3. **Implement the task completely with working code:**
   - Follow existing code patterns and conventions from the workspace
   - Create working, tested functionality that meets the task requirements
   - Use `create_file` for new files, `replace_string_in_file` or `insert_edit_into_file` for updates
   - Include proper error handling, documentation, and following best practices

4. **Mark task complete and check phase status:**
   - Update plan file: change `[ ]` to `[x]` for completed task
   - If ALL tasks in a phase are complete `[x]`, mark the phase header as complete `[x]`
   - **IMMEDIATELY when a phase is marked complete**: Update the changes file with detailed release documentation for that phase including all files modified, features added/changed, technical details, and breaking changes

### 3. Implementation Quality Standards

**Every implementation MUST:**
- Follow existing workspace patterns and conventions (check `copilot/` folder for standards)
- Implement complete, working functionality that meets all task requirements
- Include appropriate error handling and validation
- Use consistent naming conventions and code structure from the workspace
- Add necessary documentation and comments for complex logic
- Ensure compatibility with existing systems and dependencies

### 4. Continuous Progress and Validation

**After implementing each task:**
1. Use `read_file` to validate the changes made
2. Use `get_errors` to check for syntax or formatting issues
3. Fix any problems before moving to the next task
4. Update the plan file to mark completed tasks `[x]`
5. Continue to the next unchecked task

**Continue until:**
- All tasks in the plan are marked complete `[x]`
- All specified files have been created or updated with working code
- All success criteria from the plan have been verified

### 5. Reference Gathering Guidelines

**When gathering external references:**
- Use specific, relevant search terms for GitHub repository searches
- Focus on practical implementation examples over theoretical documentation
- Validate that external sources contain actual usable patterns
- Adapt external patterns to match workspace conventions and standards

**When implementing from references:**
- Follow workspace patterns and conventions first, external patterns second
- Implement complete, working functionality rather than just examples
- Ensure all dependencies and configurations are properly integrated
- Test that implementations work within the existing project structure

### 6. Completion and Documentation

**Implementation is complete when:**
- All plan tasks are marked complete `[x]`
- All specified files exist with working, tested code
- All success criteria from the plan are verified
- No implementation errors remain

**Final step - update changes file with release summary:**
- Add Release Summary section only after ALL tasks complete
- Document total changes, dependencies, breaking changes, and deployment notes for release documentation

### 7. Problem Resolution

**When encountering implementation issues:**
- Document the specific problem clearly
- Try alternative approaches or search terms
- Use workspace patterns as fallback when external references fail
- Continue with available information rather than stopping completely
- Note any unresolved issues in the plan file for future reference

## Implementation Workflow

```
1. Read plan and changes files completely
2. Gather context for first unchecked task
3. Implement task with working code following workspace patterns
4. Validate implementation and fix any issues
5. Mark task complete [x] in plan file
6. If phase complete, immediately update changes file with detailed release documentation
7. Move to next unchecked task
8. Repeat until all tasks complete
9. Add final Release Summary to changes file
```

## Success Criteria

Implementation is complete when:
- ✅ All plan tasks are marked complete `[x]`
- ✅ All specified files contain working, tested code
- ✅ Code follows workspace patterns and conventions
- ✅ All functionality works as expected within the project
- ✅ Changes file documents all phases with detailed release-ready documentation and final release summary

## Template Changes File

Use the following as a template for the changes file that tracks implementation progress for releases.
Replace `{{ }}` with appropriate values. Create this file in `./.copilot-tracking/changes/` with filename: `YYYYMMDD-task-description-changes.md`

**IMPORTANT**: Update this file after EVERY phase completion with detailed release-ready documentation.
**MANDATORY**: Always include the following at the top of the changes file: `<!-- markdownlint-disable-file -->`

<!-- <changes-template> -->
```markdown
<!-- markdownlint-disable-file -->
# Release Changes: {{task name}}

**Related Plan**: {{plan-file-name}}
**Implementation Date**: {{YYYY-MM-DD}}
**Version Impact**: {{Major|Minor|Patch}}

## Summary

{{Brief description of the overall changes made for this release}}

## Changes by Phase

### Phase 1: {{Phase Name}} ({{completion-date}})

#### Added

- {{new-file-path}} - {{description of new functionality}}
- {{new-feature}} - {{description of feature added}}

#### Changed

- {{modified-file-path}} - {{description of modifications made}}
- {{updated-feature}} - {{description of feature changes}}

#### Fixed

- {{bug-fix-description}} - {{file-path}} - {{issue resolved}}

#### Removed

- {{deprecated-feature}} - {{reason for removal}}

#### Technical Details

- **Dependencies Added**: {{new-dependencies}}
- **Configuration Changes**: {{config-updates}}
- **Breaking Changes**: {{breaking-changes-if-any}}
- **Migration Notes**: {{migration-steps-if-needed}}

### Phase 2: {{Phase Name}} ({{completion-date}})

#### Added

- {{new-functionality}}

#### Changed

- {{modifications-made}}

#### Fixed

- {{issues-resolved}}

#### Removed

- {{deprecated-items}}

#### Technical Details

- **Dependencies Added**: {{dependencies}}
- **Configuration Changes**: {{configurations}}
- **Breaking Changes**: {{breaking-changes}}
- **Migration Notes**: {{migration-steps}}

## Release Summary

**Release Type**: {{Major|Minor|Patch}}
**Total Files Affected**: {{number}}

### Files Created ({{count}})

- {{file-path}} - {{purpose}}

### Files Modified ({{count}})

- {{file-path}} - {{changes-made}}

### Files Removed ({{count}})

- {{file-path}} - {{reason}}

### Dependencies & Infrastructure

- **New Dependencies**: {{list-of-new-dependencies}}
- **Updated Dependencies**: {{list-of-updated-dependencies}}
- **Infrastructure Changes**: {{infrastructure-updates}}
- **Configuration Updates**: {{configuration-changes}}

### Breaking Changes & Migration

{{List any breaking changes and required migration steps}}

### Testing & Validation

- **Validation Performed**: {{testing-done}}
- **Known Issues**: {{any-remaining-issues}}
- **Rollback Plan**: {{rollback-instructions}}

### Deployment Notes

{{Any specific deployment considerations or steps}}
```
<!-- </changes-template> -->
