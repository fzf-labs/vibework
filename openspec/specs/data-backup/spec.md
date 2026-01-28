# data-backup Specification

## Purpose
TBD - created by archiving change update-data-backup-vibework. Update Purpose after archive.
## Requirements
### Requirement: Export user data directory as zip
The system SHALL export the resolved `~/.vibework` directory as a zip file when the user selects Export in Data Settings.

#### Scenario: User exports data
- **WHEN** the user clicks Export and chooses a save location
- **THEN** the system writes a zip containing the `~/.vibework` directory contents
- **AND** the default filename follows `vibework-backup-YYYY-MM-DD.zip`

#### Scenario: User cancels export
- **WHEN** the user cancels the save dialog
- **THEN** the system SHALL leave all data unchanged

### Requirement: Import user data directory from zip with backup
The system SHALL import data from a zip file into `~/.vibework` after explicit confirmation and a pre-import backup.

#### Scenario: User imports data with existing directory
- **WHEN** the user selects a zip file to import
- **AND** `~/.vibework` exists
- **THEN** the system SHALL prompt for confirmation and perform a backup before replacing the directory

#### Scenario: User cancels import confirmation
- **WHEN** the user cancels the import confirmation dialog
- **THEN** the system SHALL leave the existing `~/.vibework` directory unchanged

### Requirement: Delete user data directory
The system SHALL delete the resolved `~/.vibework` directory when the user confirms Delete in Data Settings.

#### Scenario: User confirms delete
- **WHEN** the user confirms deletion
- **THEN** the system SHALL remove the `~/.vibework` directory recursively

