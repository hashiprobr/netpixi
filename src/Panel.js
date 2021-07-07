import save from './save';
import { importProperties, importAnimation } from './importer';
import { exportImage, exportVideo } from './exporter';


export default function (filename, app, settings, vertices, areas, refresh, main, warn) {
    function createButton(text) {
        const button = document.createElement('button');
        button.style.width = 'min-content';
        button.style.margin = '.5em';
        button.style.fontSize = '.75em';
        button.style.lineHeight = 'normal';
        button.innerHTML = text;
        return button;
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

    const propertiesButton = createButton('Import Properties');
    propertiesButton.addEventListener('click', () => {
        importProperties(settings, vertices, areas, refresh, scale, disable)
            .catch((error) => {
                warn(error);
            })
            .finally(enable);
    });

    const animationButton = createButton('Import Animation');
    animationButton.addEventListener('click', () => {
        disable();
        importAnimation(disable)
            .catch((error) => {
                warn(error);
            })
            .finally(enable);
    });

    const networkButton = createButton('Export Network');
    networkButton.addEventListener('click', () => {
        disable();
        const start = Date.now();
        save(filename, settings, vertices, areas)
            .catch((error) => {
                warn(error);
            })
            .finally(() => {
                console.log(`Saved in ${(Date.now() - start) / 1000} seconds`);
                enable();
            });
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

    let scale = 1;

    const zoomLabel = document.createElement('p');
    zoomLabel.style.margin = '1em .5em 1em 1em';
    zoomLabel.style.userSelect = 'none';

    const fadeLabel = document.createElement('p');
    fadeLabel.style.display = 'none';
    fadeLabel.style.margin = '1em 1em 1em .5em';
    fadeLabel.style.userSelect = 'none';

    const updatePanel = {
        scale(zoom) {
            scale = zoom / 100;
            zoomLabel.innerHTML = `Zoom: ${zoom}%`;
        },
        fadeToggle(visible) {
            if (visible) {
                fadeLabel.style.display = 'block';
            } else {
                fadeLabel.style.display = 'none';
            }
        },
        fadeChange(vertex) {
            const fade = Math.round(100 * vertex.alpha);
            fadeLabel.innerHTML = `Fade: ${fade}%`;
        },
    };

    const topPanel = document.createElement('div');
    topPanel.style.display = 'flex';
    topPanel.appendChild(propertiesButton);
    topPanel.appendChild(animationButton);
    topPanel.appendChild(networkButton);
    topPanel.appendChild(imageButton);
    topPanel.appendChild(videoButton);
    topPanel.appendChild(zoomLabel);
    topPanel.appendChild(fadeLabel);

    let playing = false;

    const playButton = document.createElement('a');
    playButton.style.margin = '.25em .5em .5em .75em';
    playButton.style.textDecoration = 'none';
    playButton.style.userSelect = 'none';
    playButton.style.cursor = 'pointer';
    playButton.innerHTML = '▶';
    playButton.addEventListener('click', () => {
        if (playing) {
            enable();
            playButton.innerHTML = '▶';
            playing = false;
        } else {
            disable();
            playButton.innerHTML = '⏸';
            playing = true;
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
