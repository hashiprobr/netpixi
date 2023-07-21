import * as PIXI from 'pixi.js';

import { isString } from './types';

export default function (uid) {
    function getRect() {
        return element.getBoundingClientRect();
    }

    function add(child) {
        element.insertBefore(child, status);
    }

    function clear() {
        status.innerHTML = '';
    }

    function warn(object) {
        if (isString(object)) {
            status.innerHTML = object;
        } else {
            status.innerHTML = 'Internal script error';
            console.error(object);
        }
    }

    function destroy() {
        app.destroy(true, {
            children: true,
            texture: true,
            baseTexture: true,
        });
    }

    function disable() {
        app.view.style.pointerEvents = 'none';
    }

    function enable() {
        app.view.style.pointerEvents = 'auto';
    }

    function connectToBody(proxies, uid, graph) {
        const resizeObserver = new ResizeObserver(() => {
            graph.updateSize();
            graph.updateBounds();
        });
        resizeObserver.observe(element);
        const mutationObserver = new MutationObserver(() => {
            if (!document.body.contains(element)) {
                mutationObserver.disconnect();
                resizeObserver.disconnect();
                delete proxies[uid];
                graph.finalize();
                destroy();
            }
        });
        mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    const app = new PIXI.Application({
        autoDensity: true,
        antialias: true,
        resolution: 2,
    });

    const status = document.createElement('p');
    status.style.margin = '.5em';
    status.style.color = '#ff0000';
    status.style.userSelect = 'none';
    status.addEventListener('click', clear);

    const element = document.getElementById(uid);
    element.appendChild(status);

    const cell = {
        getRect,
        add,
        clear,
        warn,
        destroy,
        disable,
        enable,
        connectToBody,
    };

    return { app, cell };
}
