import save from './save';
import { saveImage, saveVideo } from './media';


export default function (filename, settings, vertices, areas, main, app, warn) {
    let scale = 1;

    const label = document.createElement('p');
    label.style.margin = '1rem';
    label.style.fontSize = '13px';

    function updatePanel(zoom) {
        scale = zoom / 100;
        label.innerHTML = `${zoom}%`;
    }

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

    function enableButtons() {
        main.style.pointerEvents = 'auto';
        propertiesButton.disabled = false;
        animationButton.disabled = false;
        networkButton.disabled = false;
        imageButton.disabled = false;
        videoButton.disabled = false;
        playButton.disabled = false;
        range.disabled = false;
    }

    function disableButtons() {
        main.style.pointerEvents = 'none';
        propertiesButton.disabled = true;
        animationButton.disabled = true;
        networkButton.disabled = true;
        imageButton.disabled = true;
        videoButton.disabled = true;
        playButton.disabled = true;
        range.disabled = true;
    }

    const propertiesButton = createButton('Import Properties');
    propertiesButton.addEventListener('click', () => {
    });

    const animationButton = createButton('Import Animation');
    animationButton.addEventListener('click', () => {
    });

    const networkButton = createButton('Export Network');
    networkButton.addEventListener('click', () => {
        function initialize() {
            disableButtons();
        }
        function finalize() {
            enableButtons();
        }
        save(filename, settings, vertices, areas, initialize, finalize, warn);
    });

    const imageButton = createButton('Export Image');
    imageButton.addEventListener('click', () => {
        saveImage(filename, settings, app, scale);
    });

    const videoButton = createButton('Export Video');
    videoButton.addEventListener('click', () => {
        saveVideo();
    });
    videoButton.style.display = 'none';

    const topPanel = document.createElement('div');
    topPanel.style.display = 'flex';
    topPanel.appendChild(propertiesButton);
    topPanel.appendChild(animationButton);
    topPanel.appendChild(networkButton);
    topPanel.appendChild(imageButton);
    topPanel.appendChild(videoButton);
    topPanel.appendChild(label);

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

    return [topPanel, bottomPanel, updatePanel];
}
