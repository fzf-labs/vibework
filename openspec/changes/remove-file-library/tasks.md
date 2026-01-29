## 1. Implementation
- [ ] 1.1 Remove database schema for `files` and related indexes; add migration to drop existing table data.
- [ ] 1.2 Remove files CRUD APIs from DatabaseService and IPC handlers.
- [ ] 1.3 Remove renderer data adapter/types for file library; update UI to remove file panels and library views.
- [ ] 1.4 Remove attachment persistence utilities (disk storage and DB fields) and update message saving/loading paths.
- [ ] 1.5 Update any documentation or config that referenced file artifacts or attachments.

## 2. Validation
- [ ] 2.1 Verify app startup migration on an existing database.
- [ ] 2.2 Smoke-test creating tasks and sending messages without file/attachment persistence.
