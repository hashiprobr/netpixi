import * as ponyfill from 'web-streams-polyfill/ponyfill';
import streamSaver from 'streamsaver';

import { useDeflate } from './zipnet';

if (!streamSaver.WritableStream) {
    streamSaver.WritableStream = ponyfill.WritableStream;
}

function parseInt(value) {
    const valueInt = Number.parseInt(value);
    if (Number.isNaN(valueInt)) {
        return value;
    }
    return valueInt;
}

export default function (graph, filename) {
    const {
        settings,
        vertices,
        areas,
    } = graph;

    return new Promise((resolve) => {
        const stream = streamSaver.createWriteStream(filename);
        const writer = stream.getWriter();

        window.addEventListener('unload', () => {
            writer.abort();
        });

        function process(chunk) {
            writer.write(chunk);
        }

        function finalize() {
            writer.close();
            resolve();
        }

        try {
            const [pushLine, pushEnd] = useDeflate(process, finalize);

            if (settings.props !== null && Object.keys(settings.props).length > 0) {
                pushLine('settings', {}, settings.props);
            }

            for (const [id, vertex] of Object.entries(vertices)) {
                const data = {
                    id: parseInt(id),
                };
                const props = { ...vertex.props };
                props._x = vertex.x;
                props._y = vertex.y;
                if (vertex.key !== '') {
                    props._key = vertex.key;
                }
                if (vertex.value !== '') {
                    props._value = vertex.value;
                }
                pushLine('vertex', data, props);
            }

            for (const [u, area] of Object.entries(areas)) {
                for (const [v, neighborList] of Object.entries(area.neighbors)) {
                    for (const neighbor of neighborList) {
                        let source;
                        let target;
                        if (neighbor.reversed) {
                            source = v;
                            target = u;
                        } else {
                            source = u;
                            target = v;
                        }
                        const data = {
                            source: parseInt(source),
                            target: parseInt(target),
                        };
                        const props = { ...neighbor.props };
                        if (neighbor.label !== '') {
                            props._label = neighbor.label;
                        }
                        pushLine('edge', data, props);
                    }
                }
            }

            pushEnd();
        } catch (error) {
            writer.close();
            throw error;
        }
    });
}
