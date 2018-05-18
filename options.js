var defaultMinTime = 120,
    defaultMinWords = 1,
    maxMinTime = 180;

function noop() {}

function getStorageValues() {
    chrome.storage.sync.get(['min_time'], function _storageRequestCallback(result) {
        let time = result && result.min_time ? result.min_time : defaultMinTime;
        document.getElementById('min_time').value = time;
    });

    chrome.storage.sync.get(['min_words'], function _storageRequestCallback(result) {
        let words = result && result.min_words ? result.min_words : defaultMinWords;
        document.getElementById('min_words').value = words;
    });
}

function setStorageValues() {
    let time = document.getElementById('min_time').value,
        words = document.getElementById('min_words').value;

    if (maxMinTime < time) return;
    chrome.storage.set({ min_time: time }, noop);
    chrome.storage.set({ min_words: words }, noop);
}

getStorageValues();

document.getElementById('min_time').addEventListener('input', function _minTimeHandler(e) {
    let val = Number.parseInt(e.target.value);
    if (NaN !== val && -1 < val && 176 > val) {
        let errorSpan = document.getElementById('time_error');
        if (errorSpan) document.getElementById('time').removeChild(errorSpan);
        chrome.storage.sync.set({ min_time: val }, noop);
    }
    else if (!document.getElementById('time_error')) {
        let errorSpan = document.createElement('span');
        errorSpan.id = 'time_error';
        errorSpan.classList.add('error');

        if (NaN === val) errorSpan.innerText = 'The value entered is not a number. Please enter a number or the previously saved value will be used instead.';
        else if (175 < val) errorSpan.innerText = 'The value entered is too high. Please enter a number less than 176 seconds.';
        else errorSpan.innerText = 'The minimum time value cannot be less than zero. Please enter a larger number.';

        document.getElementById('time').appendChild(errorSpan);
    }
});

document.getElementById('min_words').addEventListener('input', function _minWordsHandler(e) {
    let val = Number.parseInt(e.target.value);
    if (val) {
        let errorSpan = document.getElementById('word_error');
        if (errorSpan) document.getElementById('words').removeChild(errorSpan);
        chrome.storage.sync.set({ min_words: val }, noop);
    }
    else if (!document.getElementById('word_error')) {
        let errorSpan = document.createElement('span');
        errorSpan.id = 'word_error';
        errorSpan.classList.add('error');

        if (NaN === val) errorSpan.innerText = 'The value entered is not a number. Please enter a number or the previously saved value will be used instead.';
        else errorSpan.innerText = 'The minimum words value cannot be less than one. Please enter a larger number.';

        document.getElementById('words').appendChild(errorSpan);
    }
})