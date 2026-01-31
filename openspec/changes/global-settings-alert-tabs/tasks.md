## 1. Settings UI & State

- [x] 1.1 Locate global settings page/state and add two new tabs: 提示音、通知
- [x] 1.2 Add toggles for sound alerts and desktop notifications (task/node) with persisted storage
- [x] 1.3 Add sound preset selection and custom file picker for task completion and task node completion
- [x] 1.4 Simplify 通知 tab to remove permission status panel

## 2. Alert Behavior

- [x] 2.1 Add/locate task completion event hook for unified alert triggering
- [x] 2.2 Implement sound playback on task completion when sound alerts enabled (preset or custom file)
- [x] 2.3 Implement sound playback on task node completion when sound alerts enabled (preset or custom file)
- [x] 2.4 Implement desktop notification dispatch on task completion when enabled and permission granted
- [x] 2.5 Implement desktop notification dispatch on task node completion when enabled and permission granted
- [x] 2.6 Handle permission request flow when enabling notifications and keep toggle off on denial

## 3. Validation

- [ ] 3.1 Add tests for settings persistence and toggle behavior
- [ ] 3.2 Add tests for task completion alert triggers (sound/notification)
- [ ] 3.3 Verify behavior across supported environments and document any limitations
