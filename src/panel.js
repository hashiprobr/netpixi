import save from './save';
import { importProperties, importAnimation } from './importer';
import { exportImage, exportVideo } from './exporter';


export default function (filename, settings, vertices, areas, main, app, warn) {
    function createButton(text) {
        const button = document.createElement('button');
        button.style.width = 'min-content';
        button.style.margin = '.5em';
        button.style.fontSize = '.75em';
        button.style.lineHeight = 'normal';
        button.innerHTML = text;
        return button;
    }

    function enable() {
        main.style.pointerEvents = 'auto';
        propertiesButton.disabled = false;
        animationButton.disabled = false;
        networkButton.disabled = false;
        imageButton.disabled = false;
        videoButton.disabled = false;
        playButton.disabled = false;
        range.disabled = false;
    }

    function disable() {
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
        disable();
        importProperties()
            .catch((error) => {
                warn(error);
            })
            .finally(enable);
    });

    const animationButton = createButton('Import Animation');
    animationButton.addEventListener('click', () => {
        disable();
        importAnimation()
            .catch((error) => {
                warn(error);
            })
            .finally(enable);
    });

    const networkButton = createButton('Export Network');
    networkButton.addEventListener('click', () => {
        disable();
        save(filename, settings, vertices, areas)
            .catch((error) => {
                warn(error);
            })
            .finally(enable);
    });

    const imageButton = createButton('Export Image');
    imageButton.addEventListener('click', () => {
        disable();
        exportImage(filename, settings, app, scale)
            .catch((error) => {
                warn(error);
            })
            .finally(enable);
    });

    const videoButton = createButton('Export Video');
    videoButton.style.display = 'none';
    videoButton.addEventListener('click', () => {
        disable();
        exportVideo()
            .catch((error) => {
                warn(error);
            })
            .finally(enable);
    });

    function updatePanel(zoom) {
        scale = zoom / 100;
        label.innerHTML = `${zoom}%`;
    }

    let scale = 1;

    const label = document.createElement('p');
    label.style.margin = '1em';
    label.style.userSelect = 'none';

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
    playButton.style.margin = '.25em .5em .5em .75em';
    playButton.style.textDecoration = 'none';
    playButton.style.userSelect = 'none';
    playButton.style.cursor = 'pointer';
    playButton.innerHTML = '▶';
    playButton.addEventListener('click', () => {
        if (playing) {
            playButton.innerHTML = '▶';
            playing = false;
            enable();
        } else {
            playButton.innerHTML = '⏸';
            playing = true;
            disable();
        }
    });

    const range = document.createElement('input');
    range.type = 'range';
    range.style.flexGrow = 1;

    const bottomPanel = document.createElement('div');
    bottomPanel.style.display = 'none';
    bottomPanel.appendChild(playButton);
    bottomPanel.appendChild(range);

    return [updatePanel, topPanel, bottomPanel];
}
