import * as ponyfill from 'web-streams-polyfill/ponyfill';
import streamSaver from 'streamsaver';

import { useDeflate } from './zipnet';

if (!streamSaver.WritableStream) {
    streamSaver.WritableStream = ponyfill.WritableStream;
}


export default function (filename, settings, vertices, areas) {
    return new Promise((response, reject) => {
        const stream = streamSaver.createWriteStream(filename);
        const writer = stream.getWriter();

        window.addEventListener('unload', () => {
            try {
                writer.abort();
            } catch (error) {
                reject(error);
            }
        });

        function process(chunk) {
            writer.write(chunk);
        }

        const [pushLine, pushEnd] = useDeflate(process, response);

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

        writer.close();
    });
}
