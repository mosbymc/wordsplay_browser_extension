var extension = 'undefined' !== typeof chrome && chrome.storage ? chrome : browser,
    defaultMinTime = 120,
    defaultMinWords = 1,
    maxMinTime = 176;

function noop() {}

//Gets the values currently in storage and displays them in the various inputs
function getStorageValues() {
    extension.storage.sync.get(['min_time'], function _storageRequestCallback(result) {
        document.getElementById('min_time').value = result && result.min_time ? result.min_time : defaultMinTime;
    });

    extension.storage.sync.get(['min_words'], function _storageRequestCallback(result) {
        document.getElementById('min_words').value = result && result.min_words ? result.min_words : defaultMinWords;
    });

    extension.storage.sync.get(['clear_4'], function _storageRequestClear4Callback(result) {
        let clear4 = result.clear_4;
        if (true === clear4 || false === clear4) document.getElementById('b4x4').checked = clear4;
    });

    extension.storage.sync.get(['clear_5'], function _storageRequestClear5Callback(result) {
        let clear5 = result.clear_5;
        if (true === clear5 || false === clear5) document.getElementById('b5x5').checked = clear5;
    });
}

getStorageValues();

//Creates the error span elements when an error has been found
function createErrorSpan(spanId) {
    let span = document.createElement('span');
    span.id = spanId;
    span.classList.add('error');
    return span;
}

//Input event handler for the 'min_time' input - creates/removes error spans on the input event to
//notify the user of bad values
document.getElementById('min_time').addEventListener('input', function _minTimeInputHandler(e) {
    let val = Number.parseInt(e.target.value);
    if (!Number.isNaN(val) && -1 < val && maxMinTime > val) {
        let errorSpan = document.getElementById('time_error');
        if (errorSpan) document.getElementById('time').removeChild(errorSpan);
    }
    else {
        let errorSpan,
            found;
        if (!(found = errorSpan = document.getElementById('time_error'))) errorSpan = createErrorSpan('time_error');

        if (Number.isNaN(val)) errorSpan.innerText = 'The value entered is not a number. Please enter a number or the previously saved value will be used instead.';
        else if (maxMinTime < val) errorSpan.innerText = 'The value entered is too high. Please enter a number less than 176 seconds.';
        else errorSpan.innerText = 'The minimum time value cannot be less than zero. Please enter a larger number.';

        if (!found) document.getElementById('time').appendChild(errorSpan);
    }
});

//Input event handler for the 'min_words' input - creates/removes error spans on the input event to
//notify the user of bad values
document.getElementById('min_words').addEventListener('input', function _minWordsHandler(e) {
    let val = Number.parseInt(e.target.value);
    if (val && 0 < val) {
        let errorSpan = document.getElementById('word_error');
        if (errorSpan) document.getElementById('words').removeChild(errorSpan);
    }
    else {
        let errorSpan, found;
        if (!(found = errorSpan = document.getElementById('word_error'))) errorSpan = createErrorSpan('word_error');

        if (Number.isNaN(val)) errorSpan.innerText = 'The value entered is not a number. Please enter a number or the previously saved value will be used instead.';
        else errorSpan.innerText = 'The minimum words value cannot be less than one. Please enter a larger number.';

        if (!found) document.getElementById('words').appendChild(errorSpan);
    }
});

//Click event handler for the submit button. If there are no errors, all values are saved, otherwise none are.
document.getElementById('submit').addEventListener('click', function _submitOptionsHandler(e) {
    let error = document.getElementById('time_error') || document.getElementById('word_error');

    if (!error) {
        let timeVal = Number.parseInt(document.getElementById('min_time').value),
            wordVal = Number.parseInt(document.getElementById('min_words').value);

        extension.storage.sync.set({ min_time: timeVal }, noop);
        extension.storage.sync.set({ min_words: wordVal }, noop);
        extension.storage.sync.set({ clear_4: document.getElementById('b4x4').checked }, noop);
        extension.storage.sync.set({ clear_5: document.getElementById('b5x5').checked }, noop);
    }
});