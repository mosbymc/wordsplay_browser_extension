if ('undefined' !== typeof chrome && chrome.runtime) {
    chrome.runtime.onInstalled.addListener(function _installedExtensionHandler() {
        // Replace all rules ...
        chrome.declarativeContent.onPageChanged.removeRules(undefined, function _pageChangedEventHandler() {
            // With a new rule ...
            chrome.declarativeContent.onPageChanged.addRules([
                {
                    // That fires when a page's URL contains a 'g' ...
                    conditions: [
                        new chrome.declarativeContent.PageStateMatcher({
                            pageUrl: { urlContains: '://www.wordsplay.net/' },
                        })
                    ],
                    // And shows the extension's page action.
                    actions: [ new chrome.declarativeContent.ShowPageAction() ]
                }
            ]);
        });
    });
}
else {
    browser.tabs.onUpdated.addListener(function _browserTabUpdatedEventHandler(tabId, changeInfo, tabInfo) {
        if (changeInfo.url && ~changeInfo.url.indexOf('://www.wordsplay.net')) {
            browser.pageAction.show(tabId);
        }
    });
}