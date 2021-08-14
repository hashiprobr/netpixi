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

            pushLine('settings', {}, settings.props);

            for (const [id, vertex] of Object.entries(vertices)) {
                const props = { ...vertex.props };
                props.x = vertex.x;
                props.y = vertex.y;
                if (vertex.key !== '') {
                    props.key = vertex.key;
                }
                if (vertex.value !== '') {
                    props.value = vertex.value;
                }
                const data = {
                    id: parseInt(id),
                };
                pushLine('vertex', data, props);
            }

            for (const [u, area] of Object.entries(areas)) {
                for (const [v, neighbor] of Object.entries(area.neighbors)) {
                    let source;
                    let target;
                    if (neighbor.reversed) {
                        source = v;
                        target = u;
                    } else {
                        source = u;
                        target = v;
                    }
                    const props = { ...neighbor.props };
                    if (neighbor.label !== '') {
                        props.label = neighbor.label;
                    }
                    const data = {
                        source: parseInt(source),
                        target: parseInt(target),
                    };
                    pushLine('edge', data, props);
                }
            }

            pushEnd();
        } catch (error) {
            writer.close();
            throw error;
        }
    });
}
