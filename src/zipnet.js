import pako from 'pako';


function useInflate(process, response) {
    const inflate = new pako.Inflate({ to: 'string' });

    let buffer = '';

    inflate.onData = (chunk) => {
        buffer += chunk;
        let begin = 0;
        let index;
        while ((index = buffer.indexOf('\n', begin)) !== -1) {
            process(buffer.slice(begin, index));
            begin = index + 1;
        }
        buffer = buffer.slice(begin);
    };

    inflate.onEnd = (status) => {
        if (status === 0) {
            if (buffer.length > 0) {
                process(buffer);
            }
            response();
        } else {
            if (inflate.msg.length === 0) {
                throw 'Invalid ZipNet file';
            } else {
                throw inflate.msg;
            }
        }
    };

    return inflate;
}


function useDeflate(process, response) {
    const deflate = new pako.Deflate({ gzip: true });

    const encoder = new TextEncoder();

    deflate.onData = (chunk) => {
        process(chunk);
    };

    deflate.onEnd = (status) => {
        if (status === 0) {
            response();
        } else {
            if (deflate.msg.length === 0) {
                throw 'Invalid ZipNet file';
            } else {
                throw deflate.msg;
            }
        }
    };

    function pushLine(type, data, props) {
        data.type = type;
        if (props !== null) {
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
