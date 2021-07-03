import save from './save';


export default function (filename, settings, vertices, areas, warn) {
    function createButton(text) {
        const button = document.createElement('button');
        button.style.width = 'min-content';
        button.style.margin = '.5rem';
        button.style.fontSize = '11px';
        button.style.fontFamily = 'Helvetica Neue, Helvetica, Arial, sans-serif';
        button.style.lineHeight = 1;
        button.innerHTML = text;
        return button;
    }

    const animationButton = createButton('Load Animation');
    animationButton.addEventListener('click', () => {
    });

    const settingsButton = createButton('Load Settings');
    settingsButton.addEventListener('click', () => {
    });

    const networkButton = createButton('Save Network');
    networkButton.addEventListener('click', () => {
        function initialize() {
            animationButton.disabled = true;
            settingsButton.disabled = true;
            networkButton.disabled = true;
            imageButton.disabled = true;
        }
        function finalize() {
            imageButton.disabled = false;
            networkButton.disabled = false;
            settingsButton.disabled = false;
            animationButton.disabled = false;
        }
        save(filename, settings, vertices, areas, initialize, finalize, warn);
    });

    const imageButton = createButton('Save Image');
    imageButton.addEventListener('click', () => {
    });

    const videoButton = createButton('Save Video');
    videoButton.addEventListener('click', () => {
    });
    videoButton.disabled = true;

    const topPanel = document.createElement('div');
    topPanel.style.display = 'flex';
    topPanel.appendChild(animationButton);
    topPanel.appendChild(settingsButton);
    topPanel.appendChild(networkButton);
    topPanel.appendChild(imageButton);
    topPanel.appendChild(videoButton);

    let playing = false;

    const playButton = document.createElement('a');
    playButton.style.margin = '.25rem .5rem .5rem .75rem';
    playButton.style.textDecoration = 'none';
    playButton.style.userSelect = 'none';
    playButton.style.cursor = 'pointer';
    playButton.innerHTML = '▶';
    playButton.addEventListener('click', () => {
        if (playing) {
            playButton.innerHTML = '▶';
            playing = false;
        } else {
            playing = true;
            playButton.innerHTML = '⏸';
        }
    });

    const range = document.createElement('input');
    range.type = 'range';
    range.style.flexGrow = 1;

    const bottomPanel = document.createElement('div');
    bottomPanel.style.display = 'none';
    bottomPanel.appendChild(playButton);
    bottomPanel.appendChild(range);

    return [topPanel, bottomPanel];
}
