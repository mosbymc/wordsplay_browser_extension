var metricsDesc = {
    gamesPlayed: 'Games Played: ',
    highestScore: 'Highest Score: ',
    lowestScore: 'Lowest Score: ',
    highestRank: 'Highest Rank: ',
    lowestRank: 'Lowest Rank: ',
    averageRankPercentile: 'Average Rank Percentile: ',
    mostGameWords: 'Most Words In A Game: ',
    averageWordPoints: 'Average Points Per Words: ',
    uniqueWords: 'Unique Words: ',
    longestWords: 'Longest Words: '
};

function getMetrics(cb) {
    chrome.tabs.query({active: true, currentWindow: true}, function _tabs(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'get_metrics' }, function _sentMessageCallback(response) {
            cb(response);
        });
    });
}

getMetrics(function _metricsCallback(metrics) {
    Array.from(document.querySelectorAll('.metrics_div'))
        .forEach(function _addMetricToDOM(div) {
            let divId = div.id;
            if (divId in metrics) {
                if ('longestWords' !== divId && 'uniqueWords' !== divId) {
                    let span = document.createElement('span');
                    span.innerText = metricsDesc[divId] + metrics[divId];
                    div.appendChild(span);
                }
                else {
                    let descSpan = document.createElement('span');
                    descSpan.innerText = metricsDesc[divId];
                    div.appendChild(descSpan);

                    for (let word in metrics[divId]) {
                        let span = document.createElement('span');
                        span.innerText = word;
                        div.appendChild(span);
                    }
                }
            }
        });
});