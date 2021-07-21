import save from './save';
import { importProperties, importAnimation } from './importer';
import { exportImage, exportVideo } from './exporter';


export default function (app, cell, graph, animation, filename) {
    let disabled;

    let playing;

    function isDisabled() {
        return disabled;
    }

    function initializeDisabled() {
        disabled = false;
    }

    function initializePlaying() {
        playing = false;
        playButton.innerHTML = '▶';
        enableExceptPlay();
    }

    function createButton(title) {
        const button = document.createElement('button');
        button.style.width = 'min-content';
        button.style.margin = '.5em';
        button.style.fontSize = '.75em';
        button.style.lineHeight = 'normal';
        button.innerHTML = title;
        return button;
    }

    function disableExceptPlay() {
        disabled = true;
        propertiesButton.disabled = true;
        networkButton.disabled = true;
        imageButton.disabled = true;
        animationButton.disabled = true;
        videoButton.disabled = true;
        range.disabled = true;
        cell.disable();
        cell.clear();
    }

    function disable() {
        disableExceptPlay();
        playButton.style.pointerEvents = 'none';
    }

    function enable() {
        playButton.style.pointerEvents = 'auto';
        enableExceptPlay();
    }

    function enableExceptPlay() {
        cell.enable();
        range.disabled = false;
        videoButton.disabled = false;
        animationButton.disabled = false;
        imageButton.disabled = false;
        networkButton.disabled = false;
        propertiesButton.disabled = false;
        initializeDisabled();
    }

    function updateZoom() {
        const zoom = Math.round(100 * graph.getScale());
        zoomLabel.innerHTML = `zoom: ${zoom}%`;
    }

    function updateOpacity(vertex) {
        const opacity = Math.round(100 * vertex.alpha);
        opacityLabel.innerHTML = `edge opacity: ${opacity}%`;
    }

    function showOpacity() {
        opacityLabel.style.display = 'block';
    }

    function hideOpacity() {
        opacityLabel.style.display = 'none';
    }

    function toggleAnimation() {
        if (animation.tweens.length === 0) {
            media.style.display = 'none';
            bottom.style.display = 'none';
        } else {
            bottom.style.display = 'flex';
            media.style.display = 'inline-flex';
        }
    }

    const propertiesButton = createButton('import properties');
    propertiesButton.addEventListener('click', () => {
        importProperties(graph, disable)
            .catch((error) => {
                cell.warn(error);
            })
            .finally(enable);
    });

    const networkButton = createButton('save network');
    networkButton.addEventListener('click', () => {
        disable();
        const start = Date.now();
        save(graph, filename)
            .catch((error) => {
                cell.warn(error);
            })
            .finally(() => {
                console.log(`Saved in ${(Date.now() - start) / 1000} seconds`);
                enable();
            });
    });

    const imageButton = createButton('export png');
    imageButton.addEventListener('click', () => {
        disable();
        exportImage(app, graph, filename)
            .catch((error) => {
                cell.warn(error);
            })
            .finally(enable);
    });

    const zoomLabel = document.createElement('p');
    zoomLabel.style.margin = '1em 0 1em 1em';
    zoomLabel.style.fontSize = '.75em';
    zoomLabel.style.whiteSpace = 'nowrap';
    zoomLabel.style.userSelect = 'none';

    const opacityLabel = document.createElement('p');
    opacityLabel.style.display = 'none';
    opacityLabel.style.margin = '1em 0 1em 1em';
    opacityLabel.style.fontSize = '.75em';
    opacityLabel.style.whiteSpace = 'nowrap';
    opacityLabel.style.userSelect = 'none';

    const top = document.createElement('div');
    top.style.display = 'flex';
    top.appendChild(propertiesButton);
    top.appendChild(networkButton);
    top.appendChild(imageButton);
    top.appendChild(zoomLabel);
    top.appendChild(opacityLabel);

    const animationButton = createButton('import animation');
    animationButton.addEventListener('click', () => {
        importAnimation(graph, animation, disable)
            .catch((error) => {
                cell.warn(error);
            })
            .finally(() => {
                toggleAnimation();
                enable();
            });
    });

    const videoButton = createButton('export video');
    videoButton.addEventListener('click', () => {
        disable();
        exportVideo()
            .catch((error) => {
                cell.warn(error);
            })
            .finally(enable);
    });

    const media = document.createElement('div');
    media.style.display = 'none';
    media.appendChild(videoButton);

    const frameLabel = document.createElement('p');
    frameLabel.innerHTML = 'no frames';
    frameLabel.style.margin = '1em 0 1em 1em';
    frameLabel.style.fontSize = '.75em';
    frameLabel.style.whiteSpace = 'nowrap';
    frameLabel.style.userSelect = 'none';

    const middle = document.createElement('div');
    middle.style.display = 'flex';
    middle.appendChild(animationButton);
    middle.appendChild(media);
    middle.appendChild(frameLabel);

    const playButton = document.createElement('a');
    playButton.style.margin = '.25em .5em .5em';
    playButton.style.textDecoration = 'none';
    playButton.style.userSelect = 'none';
    playButton.style.cursor = 'pointer';
    playButton.style.pointerEvents = 'auto';
    playButton.addEventListener('click', () => {
        if (playing) {
            initializePlaying();
        } else {
            disableExceptPlay();
            playButton.innerHTML = '⏸';
            playing = true;
        }
    });

    const range = document.createElement('input');
    range.type = 'range';
    range.style.flexGrow = 1;

    const bottom = document.createElement('div');
    bottom.style.display = 'none';
    bottom.appendChild(playButton);
    bottom.appendChild(range);

    initializeDisabled();
    initializePlaying();
    updateZoom();

    return {
        top,
        middle,
        bottom,
        isDisabled,
        disable,
        enable,
        updateZoom,
        updateOpacity,
        showOpacity,
        hideOpacity,
        toggleAnimation,
    };
}
