import * as ponyfill from 'web-streams-polyfill/ponyfill';
import streamSaver from 'streamsaver';

import { useDeflate } from './zipnet';

if (!streamSaver.WritableStream) {
    streamSaver.WritableStream = ponyfill.WritableStream;
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

        const [pushLine, pushEnd] = useDeflate(process, finalize);

        pushLine('settings', {}, settings.props);

        for (const [id, vertex] of Object.entries(vertices)) {
            pushLine('vertex', { id }, { x: vertex.x, y: vertex.y, ...vertex.props });
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
                pushLine('edge', { source, target }, neighbor.props);
            }
        }

        pushEnd();
    });
}
