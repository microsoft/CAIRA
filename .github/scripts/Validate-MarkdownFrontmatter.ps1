# Validate-MarkdownFrontmatter.ps1
#
# Purpose: Validates frontmatter consistency across markdown files in the repository
# Author: CAIRA Team
# Created: 2025-06-17
#
# This script provides dedicated frontmatter validation functionality without the overhead
# of loading sidebar generation logic. It validates required fields, date formats, and
# content structure across different types of documentation.

param(
    [Parameter(Mandatory = $false)]
    [string[]]$Paths = @('docs', 'modules', 'reference_architectures', '.github'),

    [Parameter(Mandatory = $false)]
    [string[]]$Files = @(),

    [Parameter(Mandatory = $false)]
    [string[]]$ExcludePatterns = @('*\.terraform\*', '*/CHANGELOG.md'),

    [Parameter(Mandatory = $false)]
    [switch]$WarningsAsErrors,

    [Parameter(Mandatory = $false)]
    [switch]$ChangedFilesOnly,

    [Parameter(Mandatory = $false)]
    [string]$BaseBranch = "origin/main",

    [Parameter(Mandatory = $false)]
    [switch]$DebugOutput
)

function Get-MarkdownFrontmatter {
    <#
    .SYNOPSIS
    Extracts YAML frontmatter from a markdown file supporting both HTML comment and YAML delimited formats.

    .DESCRIPTION
    Parses frontmatter from the beginning of a markdown file in either HTML comment format (<!-- ... -->)
    or YAML delimiter format (--- ... ---) and returns a structured object containing the frontmatter data and content.

    .PARAMETER FilePath
    Path to the markdown file to parse.

    .OUTPUTS
    Returns a hashtable with Frontmatter, FrontmatterEndIndex, and Content properties.
    #>
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$FilePath
    )

    if (-not (Test-Path $FilePath)) {
        Write-Warning "File not found: $FilePath"
        return $null
    }

    try {
        $content = Get-Content -Path $FilePath -Raw -Encoding UTF8

        # Detect frontmatter format
        $frontmatterType = $null
        $startDelimiter = $null
        $endDelimiter = $null

        if ($content.StartsWith("<!--")) {
            $frontmatterType = "html_comment"
            $startDelimiter = "<!--"
            $endDelimiter = "-->"
        }
        elseif ($content.StartsWith("---")) {
            $frontmatterType = "yaml"
            $startDelimiter = "---"
            $endDelimiter = "---"
        }
        else {
            # No recognized frontmatter format
            return $null
        }

        # Find the end of frontmatter based on detected format
        $lines = $content -split "`r`n|`r|`n"
        $endIndex = -1

        for ($i = 1; $i -lt $lines.Count; $i++) {
            if ($lines[$i].Trim() -eq $endDelimiter) {
                $endIndex = $i
                break
            }
        }

        if ($endIndex -eq -1) {
            Write-Warning "Malformed $frontmatterType frontmatter in: $FilePath"
            return $null
        }

        # Extract frontmatter lines (excluding delimiters)
        $frontmatterLines = $lines[1..($endIndex - 1)]
        $frontmatter = @{}

        foreach ($line in $frontmatterLines) {
            if ($line.Trim() -eq "" -or $line.Trim().StartsWith("#")) {
                continue
            }

            if ($line -match "^([^:]+):\s*(.*)$") {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()

                # Handle array values (YAML arrays starting with -)
                if ($value.StartsWith("[") -and $value.EndsWith("]")) {
                    # Parse JSON-style array
                    try {
                        $frontmatter[$key] = $value | ConvertFrom-Json
                    }
                    catch {
                        $frontmatter[$key] = $value
                    }
                }
                else {
                    # Check if this is the start of a YAML array (support any indentation before '-')
                    if ($value.StartsWith("-") -or $value.Trim() -eq "") {
                        $arrayValues = @()
                        if ($value.StartsWith("-")) {
                            if ($value -match "^-\s*(.*)$") { $arrayValues += $matches[1].Trim() } else { $arrayValues += $value.Substring(1).Trim() }
                        }

                        # Look for additional array items (match lines like '  - item' with any leading whitespace)
                        $j = [array]::IndexOf($frontmatterLines, $line) + 1
                        while ($j -lt $frontmatterLines.Count -and ($frontmatterLines[$j] -match '^\s*-\s*(.*)$')) {
                            $arrayValues += $matches[1].Trim()
                            $j++
                        }

                        if ($arrayValues.Count -gt 0) {
                            $frontmatter[$key] = $arrayValues
                        }
                        else {
                            $frontmatter[$key] = $value
                        }
                    }
                    else {
                        # Remove quotes if present
                        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                            $value = $value.Substring(1, $value.Length - 2)
                        }
                        $frontmatter[$key] = $value
                    }
                }
            }
        }

        return @{
            Frontmatter         = $frontmatter
            FrontmatterEndIndex = $endIndex + 1
            Content             = if ($endIndex + 1 -lt $lines.Count) { ($lines[($endIndex + 1)..($lines.Count - 1)] -join "`n") } else { "" }
            FrontmatterType     = $frontmatterType
        }
    }
    catch {
        # Return a special indicator for parsing errors
        return @{ ParseError = $true }
    }
}

function Test-FrontmatterValidation {
    <#
    .SYNOPSIS
    Validates frontmatter across all markdown files in specified paths.

    .DESCRIPTION
    Performs comprehensive frontmatter validation including required fields,
    date format validation, and content type-specific requirements.

    .PARAMETER Paths
    Array of paths to search for markdown files.

    .PARAMETER Files
    Array of specific file paths to validate (takes precedence over Paths).

    .PARAMETER WarningsAsErrors
    Treat warnings as errors (fail validation on warnings).

    .OUTPUTS
    Returns validation results with errors and warnings.
    #>
    param(
        [Parameter(Mandatory = $false)]
        [AllowEmptyCollection()]
        [string[]]$Paths = @(),

        [Parameter(Mandatory = $false)]
        [AllowEmptyCollection()]
        [string[]]$Files = @(),

        [Parameter(Mandatory = $false)]
        [AllowEmptyCollection()]
        [string[]]$ExcludePatterns = @(),

        [Parameter(Mandatory = $false)]
        [switch]$WarningsAsErrors,

        [Parameter(Mandatory = $false)]
        [switch]$ChangedFilesOnly,

        [Parameter(Mandatory = $false)]
        [string]$BaseBranch = "origin/main",

        [Parameter(Mandatory = $false)]
        [switch]$DebugOutput
    )

    Write-Host "Validating frontmatter across markdown files..." -ForegroundColor Cyan
    if ($DebugOutput) {
        Write-Host "DEBUG: Function started with ChangedFilesOnly=$ChangedFilesOnly" -ForegroundColor Magenta
    }

    # Input validation and sanitization
    $errors = @()
    $warnings = @()

    # If ChangedFilesOnly is specified, get changed files from git
    if ($ChangedFilesOnly) {
        Write-Host "Detecting changed markdown files from git diff..." -ForegroundColor Cyan
        $gitChangedFiles = Get-ChangedMarkdownFileGroup -BaseBranch $BaseBranch
        if ($gitChangedFiles.Count -gt 0) {
            $Files = $gitChangedFiles
            Write-Host "Found $($Files.Count) changed markdown files to validate" -ForegroundColor Cyan
        }
        else {
            Write-Host "No changed markdown files found - validation complete" -ForegroundColor Green
            return @{
                Errors            = @()
                Warnings          = @()
                HasIssues         = $false
                TotalFilesChecked = 0
            }
        }
    }

    # Sanitize Files array - remove empty or null entries
    if ($Files.Count -gt 0) {
        $sanitizedFiles = @()
        foreach ($file in $Files) {
            if (-not [string]::IsNullOrEmpty($file)) {
                $sanitizedFiles += $file.Trim()
            }
            else {
                Write-Verbose "Filtering out empty file path from Files array"
            }
        }
        $Files = $sanitizedFiles
    }

    # Sanitize Paths array - remove empty or null entries
    if ($Paths.Count -gt 0) {
        $sanitizedPaths = @()
        foreach ($path in $Paths) {
            if (-not [string]::IsNullOrEmpty($path)) {
                $sanitizedPaths += $path.Trim()
            }
            else {
                Write-Verbose "Filtering out empty path from Paths array"
            }
        }
        $Paths = $sanitizedPaths
    }

    # Ensure we have at least one valid input source
    if ($Files.Count -eq 0 -and $Paths.Count -eq 0) {
        $warnings += "No valid files or paths provided for validation"
        return @{
            Errors            = @()
            Warnings          = $warnings
            HasIssues         = $true
            TotalFilesChecked = 0
        }
    }

    # Get markdown files either from specific files or from paths
    $markdownFiles = @()

    if ($DebugOutput) {
        Write-Host "DEBUG: Files.Count = $($Files.Count), Paths.Count = $($Paths.Count)" -ForegroundColor Magenta
    }

    if ($Files.Count -gt 0) {
        Write-Host "Validating specific files..." -ForegroundColor Cyan
        foreach ($file in $Files) {
            if (-not [string]::IsNullOrEmpty($file) -and (Test-Path $file -PathType Leaf)) {
                if ($file -like "*.md") {
                    $fileItem = Get-Item $file
                    if ($null -ne $fileItem -and -not [string]::IsNullOrEmpty($fileItem.FullName)) {
                        $markdownFiles += $fileItem
                        Write-Verbose "Added specific file: $file"
                    }
                }
                else {
                    Write-Verbose "Skipping non-markdown file: $file"
                }
            }
            else {
                Write-Warning "File not found or invalid: $file"
            }
        }
    }
    else {
        if ($DebugOutput) {
            Write-Host "DEBUG: Using paths search" -ForegroundColor Magenta
            Write-Host "DEBUG: Paths array contains: $($Paths -join ', ')" -ForegroundColor Magenta
        }
        Write-Host "Searching for markdown files in specified paths..." -ForegroundColor Cyan

        foreach ($path in $Paths) {
            if ($DebugOutput) {
                Write-Host "DEBUG: Processing path: $path" -ForegroundColor Magenta
            }
            Write-Host "Searching in path: $path" -ForegroundColor Yellow

            if (Test-Path $path) {
                if ($DebugOutput) {
                    Write-Host "DEBUG: Path exists, getting child items..." -ForegroundColor Magenta
                }

                # Fix: Use ArrayList instead of array concatenation to preserve file objects
                $pathFiles = [System.Collections.ArrayList]::new()

                try {
                    $allFiles = Get-ChildItem -Path $path -Recurse -File -ErrorAction Stop

                    # Apply exclude patterns
                    foreach ($pattern in $ExcludePatterns) {
                        $allFiles = $allFiles | Where-Object { $_.FullName -notlike $pattern }
                    }

                    if ($DebugOutput) {
                        Write-Host "DEBUG: Get-ChildItem returned $($allFiles.Count) total files (after filtering exclude patterns)" -ForegroundColor Magenta
                    }

                    foreach ($file in $allFiles) {
                        if ($file.Extension -eq '.md') {
                            [void]$pathFiles.Add($file)
                            if ($DebugOutput) {
                                Write-Host "DEBUG: Added markdown file: '$($file.Name)'" -ForegroundColor Magenta
                            }
                        }
                    }

                    if ($DebugOutput) {
                        Write-Host "DEBUG: Filtered to $($pathFiles.Count) markdown files" -ForegroundColor Magenta
                    }

                    # Add to main collection using AddRange to preserve objects
                    $markdownFiles += $pathFiles.ToArray()

                    Write-Host "  Found $($pathFiles.Count) markdown files in $path" -ForegroundColor Yellow

                    # Debug: show some file names to verify properties are preserved
                    if ($DebugOutput) {
                        $pathFiles | Select-Object -First 3 | ForEach-Object {
                            Write-Host "    - Name: '$($_.Name)' | FullName: '$($_.FullName)'" -ForegroundColor Gray
                            if ($_.Name -eq "environment_setup.md") {
                                Write-Host "      ** Found environment_setup.md!" -ForegroundColor Green
                            }
                        }
                    }
                }
                catch {
                    if ($DebugOutput) {
                        Write-Host "DEBUG: Error in Get-ChildItem: $($_.Exception.Message)" -ForegroundColor Red
                    }
                }
            }
            else {
                Write-Warning "Path not found: $path"
            }
        }
    }

    Write-Host "Found $($markdownFiles.Count) total markdown files to validate" -ForegroundColor Cyan

    foreach ($file in $markdownFiles) {
        # Validate file object integrity
        if ($null -eq $file -or [string]::IsNullOrEmpty($file.FullName)) {
            if ($DebugOutput) {
                Write-Host "DEBUG: Skipping corrupted file object - Name: '$($file.Name)' FullName: '$($file.FullName)'" -ForegroundColor Red
            }
            continue
        }

        Write-Verbose "Validating: $($file.FullName)"

        try {
            $frontmatter = Get-MarkdownFrontmatter -FilePath $file.FullName

            # Skip files with parsing errors
            if ($frontmatter -and $frontmatter.ParseError) {
                Write-Verbose "Skipping file with parsing error: $($file.FullName)"
                continue
            }

            if ($frontmatter) {
                # Determine content type and required fields
                $isGitHub = $file.DirectoryName -like "*.github*"
                $isChatMode = $file.Name -like "*.chatmode.md"
                $isPrompt = $file.Name -like "*.prompt.md"
                $isInstruction = $file.Name -like "*.instructions.md"
                $isMainDoc = ($file.DirectoryName -like "*docs*" -or
                    $file.DirectoryName -like "*modules*" -or
                    $file.DirectoryName -like "*reference_architectures*") -and
                -not $isGitHub

                # Validate required fields for main documentation
                if ($isMainDoc) {
                    $requiredFields = @('title', 'description', 'author', 'ms.date', 'ms.topic')

                    foreach ($field in $requiredFields) {
                        if (-not $frontmatter.Frontmatter.ContainsKey($field)) {
                            $errors += "Missing required field '$field' in: $($file.FullName)"
                        }
                    }

                    # Validate date format
                    if ($frontmatter.Frontmatter.ContainsKey('ms.date')) {
                        $date = $frontmatter.Frontmatter['ms.date']
                        if ($date -notmatch '^\d{2}/\d{2}/\d{4}$') {
                            $warnings += "Invalid date format in: $($file.FullName). Expected MM/DD/YYYY, got: $date"
                        }
                    }

                    # Validate ms.topic values
                    if ($frontmatter.Frontmatter.ContainsKey('ms.topic')) {
                        $validTopics = @('concept', 'how-to', 'reference', 'tutorial', 'overview', 'architecture', 'module', 'guide')
                        $topic = $frontmatter.Frontmatter['ms.topic']
                        if ($topic -notin $validTopics) {
                            $warnings += "Invalid ms.topic value '$topic' in: $($file.FullName). Valid values: $($validTopics -join ', ')"
                        }
                    }
                }
                # GitHub resources have different requirements
                elseif ($isGitHub) {
                    # ChatMode files (.chatmode.md) have specific frontmatter structure
                    if ($isChatMode) {
                        # ChatMode files typically have description, tools, etc. but not standard doc fields
                        # Only warn if missing description as it's commonly used
                        if (-not $frontmatter.Frontmatter.ContainsKey('description')) {
                            $warnings += "ChatMode file missing 'description' field: $($file.FullName)"
                        }
                    }
                    # Instruction files (.instructions.md) have specific patterns
                    elseif ($isInstruction) {
                        # Instruction files should have 'applyTo' field for context-specific instructions
                        if (-not $frontmatter.Frontmatter.ContainsKey('applyTo')) {
                            $warnings += "Instruction file missing 'applyTo' field: $($file.FullName)"
                        }
                    }
                    # Prompt files (.prompt.md) are instructions/templates
                    elseif ($isPrompt) {
                        # Prompt files are typically instruction content, no specific frontmatter required
                        # These are generally freeform content
                    }
                    # Other GitHub files (templates, etc.)
                    elseif ($file.Name -like "*template*" -and -not $frontmatter.Frontmatter.ContainsKey('name')) {
                        $warnings += "GitHub template missing 'name' field: $($file.FullName)"
                    }
                }

                # Validate keywords (accept string or array to align with bash script)
                if ($frontmatter.Frontmatter.ContainsKey('keywords')) {
                    $keywords = $frontmatter.Frontmatter['keywords']
                    if ($keywords -is [array]) {
                        if ($keywords.Count -eq 0) {
                            $warnings += "Keywords are empty in: $($file.FullName)"
                        }
                    }
                    elseif ($keywords -is [string]) {
                        if ([string]::IsNullOrWhiteSpace($keywords)) {
                            $warnings += "Keywords are empty in: $($file.FullName)"
                        }
                        # else: non-empty string is acceptable
                    }
                    else {
                        # Unknown type; treat as non-blocking info, but do not warn as error
                        Write-Verbose "Keywords field has unexpected type in: $($file.FullName)"
                    }
                }
                # Validate estimated_reading_time if present
                if ($frontmatter.Frontmatter.ContainsKey('estimated_reading_time')) {
                    $readingTime = $frontmatter.Frontmatter['estimated_reading_time']
                    if ($readingTime -notmatch '^\d+$') {
                        $warnings += "Invalid estimated_reading_time format in: $($file.FullName). Should be a number."
                    }
                }
            }
            else {
                # Only warn for main docs, not for GitHub files, prompts, or chatmodes content
                $isGitHubLocal = $file.DirectoryName -like "*.github*"
                $isMainDocLocal = ($file.DirectoryName -like "*docs*" -or
                    $file.DirectoryName -like "*modules*" -or
                    $file.DirectoryName -like "*reference_architectures*") -and
                -not $isGitHubLocal

                # Debug output to see what's happening
                Write-Verbose "File: $($file.FullName)"
                Write-Verbose "  DirectoryName: $($file.DirectoryName)"
                Write-Verbose "  IsGitHub: $isGitHubLocal"
                Write-Verbose "  IsMainDoc: $isMainDocLocal"

                if ($isMainDocLocal) {
                    Write-Verbose "  Adding warning for missing frontmatter"
                    $warnings += "No frontmatter found in: $($file.FullName)"
                }
                else {
                    Write-Verbose "  Skipping - not a main doc file"
                }
            }
        }
        catch {
            $errors += "Error processing file '$($file.FullName)': $($_.Exception.Message)"
            Write-Verbose "Error processing file '$($file.FullName)': $($_.Exception.Message)"
        }
    }

    # Output results
    $hasIssues = $false

    Write-Host "Validation Summary:" -ForegroundColor Cyan
    Write-Host "  Total files checked: $($markdownFiles.Count)" -ForegroundColor Cyan
    Write-Host "  Warnings found: $($warnings.Count)" -ForegroundColor Cyan
    Write-Host "  Errors found: $($errors.Count)" -ForegroundColor Cyan

    if ($warnings.Count -gt 0) {
        Write-Host "Warnings found:" -ForegroundColor Magenta
        $warnings | ForEach-Object { Write-Host "  $_" -ForegroundColor Magenta }
        if ($WarningsAsErrors) {
            $hasIssues = $true
        }
    }

    if ($errors.Count -gt 0) {
        Write-Host "Errors found:" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
        $hasIssues = $true
    }

    if (-not $hasIssues) {
        if ($warnings.Count -eq 0 -and $errors.Count -eq 0) {
            Write-Host "Frontmatter validation completed successfully" -ForegroundColor Green
        }
        else {
            Write-Host "Frontmatter validation completed with warnings (non-blocking)" -ForegroundColor Green
        }
    }

    return @{
        Errors            = $errors
        Warnings          = $warnings
        HasIssues         = $hasIssues
        TotalFilesChecked = $markdownFiles.Count
    }
}

function Get-ChangedMarkdownFileGroup {
    <#
    .SYNOPSIS
    Gets list of changed markdown files from git diff.

    .DESCRIPTION
    Uses git diff to identify changed markdown files, with fallback strategies for different scenarios.

    .PARAMETER BaseBranch
    The base branch to compare against (default: origin/main).

    .OUTPUTS
    Returns array of file paths for changed markdown files.
    #>
    param(
        [Parameter(Mandatory = $false)]
        [string]$BaseBranch = "origin/main"
    )

    $changedMarkdownFiles = @()

    try {
        # Try to get changed files from the merge base
        $changedFiles = git diff --name-only $(git merge-base HEAD $BaseBranch) HEAD 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Verbose "Merge base failed, trying HEAD~1"
            # Fallback to comparing with HEAD~1 if merge-base fails
            $changedFiles = git diff --name-only HEAD~1 HEAD 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-Verbose "HEAD~1 failed, trying staged/unstaged files"
                # Last fallback - get staged and unstaged files
                $changedFiles = git diff --name-only HEAD 2>$null
                if ($LASTEXITCODE -ne 0) {
                    Write-Warning "Unable to determine changed files from git"
                    return @()
                }
            }
        }

        # Filter for markdown files that exist and are not empty
        $changedMarkdownFiles = $changedFiles | Where-Object {
            -not [string]::IsNullOrEmpty($_) -and
            $_ -match '\.md$' -and
            (Test-Path $_ -PathType Leaf)
        }

        Write-Verbose "Found $($changedMarkdownFiles.Count) changed markdown files from git diff"
        $changedMarkdownFiles | ForEach-Object { Write-Verbose "  Changed: $_" }

        return $changedMarkdownFiles
    }
    catch {
        Write-Warning "Error getting changed files from git: $($_.Exception.Message)"
        return @()
    }
}

# Main execution
if ($MyInvocation.InvocationName -ne '.') {
    # Ensure script runs from repository root directory
    try {
        $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
        $workspaceRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
        Set-Location $workspaceRoot
        Write-Verbose "Changed working directory to: $workspaceRoot"
    }
    catch {
        Write-Warning "Could not change to repository root directory: $($_.Exception.Message)"
    }

    if ($ChangedFilesOnly) {
        $result = Test-FrontmatterValidation -ChangedFilesOnly -BaseBranch $BaseBranch -ExcludePatterns $ExcludePatterns -WarningsAsErrors:$WarningsAsErrors -DebugOutput:$DebugOutput
    }
    elseif ($Files.Count -gt 0) {
        $result = Test-FrontmatterValidation -Files $Files -ExcludePatterns $ExcludePatterns -WarningsAsErrors:$WarningsAsErrors -DebugOutput:$DebugOutput
    }
    else {
        $result = Test-FrontmatterValidation -Paths $Paths -ExcludePatterns $ExcludePatterns -WarningsAsErrors:$WarningsAsErrors -DebugOutput:$DebugOutput
    }

    if ($result.HasIssues) {
        exit 1
    }
    else {
        if ($result.Warnings.Count -eq 0 -and $result.Errors.Count -eq 0) {
            Write-Host "All frontmatter validation checks passed!" -ForegroundColor Green
        }
        else {
            Write-Host "Frontmatter validation completed with warnings (non-blocking)" -ForegroundColor Green
        }
        exit 0
    }
}
