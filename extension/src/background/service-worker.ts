// When toolbar icon is clicked, toggle the overlay panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
  }
});

// Keyboard shortcut (Ctrl+Shift+F / Cmd+Shift+F)
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-panel" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
  }
});
