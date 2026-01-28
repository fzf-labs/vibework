## 1. Implementation
- [ ] 1.1 Identify the resolved user data path for `~/.vibework` using existing path APIs.
- [ ] 1.2 Implement zip export of the data directory with the default filename pattern.
- [ ] 1.3 Implement import flow: pick zip file, confirm, back up existing data directory, then restore.
- [ ] 1.4 Replace the current clear-data flow with delete-`.vibework` confirmation and removal.
- [ ] 1.5 Update data settings UI copy to reflect zip export/import and directory deletion.
- [ ] 1.6 Add error handling and user feedback for missing directories, failed zip operations, and canceled dialogs.

## 2. Validation
- [ ] 2.1 Export produces a zip with `.vibework` contents and the expected filename.
- [ ] 2.2 Import prompts for confirmation, writes a backup, and restores the directory from the zip.
- [ ] 2.3 Delete removes the directory and handles missing data directory gracefully.
