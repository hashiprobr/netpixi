import pako from 'pako';

import { isString, isObject } from './types';

function useInflate(process, finalize) {
    const inflate = new pako.Inflate({ to: 'string' });

    let i = 0;

    function fail(message) {
        throw `Line ${i}: ${message}`;
    }

    function parse(line) {
        i++;
        let data;
        try {
            data = JSON.parse(line);
        } catch (error) {
            fail(error.message);
        }
        if (!isObject(data)) {
            fail('must be an object');
        }
        if (data === null) {
            fail('cannot be null');
        }
        try {
            process(data);
        } catch (error) {
            if (isString(error)) {
                fail(error);
            }
            throw error;
        }
    }

    let buffer = '';

    inflate.onData = (chunk) => {
        buffer += chunk;
        let begin = 0;
        let index;
        while ((index = buffer.indexOf('\n', begin)) !== -1) {
            parse(buffer.slice(begin, index));
            begin = index + 1;
        }
        buffer = buffer.slice(begin);
    };

    inflate.onEnd = (status) => {
        if (status === 0) {
            if (buffer.length > 0) {
                parse(buffer);
            }
            finalize();
        } else {
            if (inflate.msg.length === 0) {
                throw 'Unknown gzip error';
            } else {
                throw inflate.msg;
            }
        }
    };

    function push(chunk, flush) {
        inflate.push(chunk, flush);
    }

    return push;
}

function useDeflate(process, finalize) {
    const deflate = new pako.Deflate({ gzip: true });

    const encoder = new TextEncoder();

    deflate.onData = (chunk) => {
        process(chunk);
    };

    deflate.onEnd = (status) => {
        if (status === 0) {
            finalize();
        } else {
            if (deflate.msg.length === 0) {
                throw 'Unknown gzip error';
            } else {
                throw deflate.msg;
            }
        }
    };

    function pushLine(type, data, props) {
        data.type = type;
        if (props !== null && Object.keys(props).length > 0) {
            data.props = props;
        }
        const line = `${JSON.stringify(data)}\n`;
        deflate.push(encoder.encode(line), false);
    }

    function pushEnd() {
        deflate.push(new Uint8Array(), true);
    }

    return [pushLine, pushEnd];
}

export { useInflate, useDeflate };
