## 1. Settings UI & State

- [ ] 1.1 Locate global settings page/state and add two new tabs: 提示音、通知
- [ ] 1.2 Add toggles for sound alerts and desktop notifications with persisted storage
- [ ] 1.3 Display notification permission state and guidance in the 通知 tab

## 2. Alert Behavior

- [ ] 2.1 Add/locate task completion event hook for unified alert triggering
- [ ] 2.2 Implement sound playback on task completion when sound alerts enabled
- [ ] 2.3 Implement desktop notification dispatch on task completion when enabled and permission granted
- [ ] 2.4 Handle permission request flow when enabling notifications and keep toggle off on denial

## 3. Validation

- [ ] 3.1 Add tests for settings persistence and toggle behavior
- [ ] 3.2 Add tests for task completion alert triggers (sound/notification)
- [ ] 3.3 Verify behavior across supported environments and document any limitations
