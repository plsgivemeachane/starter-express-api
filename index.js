const express = require('express');
const cors = require('cors');

const app = express();

app.use(
    cors({
        origin: '*'
    })
);

/**
 * Extracts the CID from the given URL.
 *
 * @param {string} url - The URL from which to extract the CID
 * @return {string} The extracted CID
 */
function extractCID(url) {
    if (url.includes('dweb')) {
        let parts = url.split('/');
        let subParts = parts[2].split('.');
        return subParts[0];
    } else {
        return url.split('/').pop();
    }
}

const eachfilesize = {};

/**
 * Calculate the total size of the files associated with the given content identifiers (CIDs).
 *
 * @param {array} cids - An array of content identifiers
 * @return {number} The total size of the files in bytes
 */
async function getFileSize(cids) {
    var fileSize = 0;
    for (var cid of cids) {
        if (cid.includes('https://')) {
            cid = extractCID(cid);
        }

        const res = await fetch(`https://ipfs.particle.network/${cid}`, {
            method: 'HEAD'
        });

        // console.log(res.headers.get("Content-Length") )

        fileSize += parseInt(res.headers.get("Content-Length") , 10);

        eachfilesize[cid] = parseInt(res.headers.get("Content-Length") , 10);
    }

    return fileSize;
}

/**
 * Formats the given number of bytes into a human-readable string representation.
 *
 * @param {number} bytes - The number of bytes to be formatted.
 * @param {number} [decimals=2] - The number of decimals to round the result to.
 * @return {string} The formatted string representation of the input bytes.
 */
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = [
        'Bytes',
        'KiB',
        'MiB',
        'GiB',
        'TiB',
        'PiB',
        'EiB',
        'ZiB',
        'YiB'
    ];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Asynchronously fetches data in chunks from the specified URL using the given headers and controller.
 *
 * @param {string} url - The URL to fetch data from
 * @param {Object} headers - The headers to include in the fetch request
 * @param {AbortController} controller - The controller to signal the fetch should be aborted
 * @param {number} start - The starting byte index for fetching data
 * @param {number} fileSize - The total size of the file being fetched
 */
// async function customFetch(url, controller, start, fileSize) {
//     console.log('Fetching ' + url);
//     // let chunkSize = 10 * 1024 * 1024; // 10 MB!
//     // for (; start < fileSize; start += chunkSize) {
//     //     let end = Math.min(start + chunkSize - 1, fileSize - 1);
//     //     // console.log('Fetch ' + start + ' - ' + end);
//     //     let headers = { Range: `bytes=${start}-${end}` };
//     //     let response = await fetch(url, { headers });

//     //     // Process the chunk of data
//     let response = await fetch(url, { headers: { Range: `bytes=${start}-${fileSize - 1}` } });
//     let chunkData = await response.arrayBuffer(); // Or other method for data type
//     controller.enqueue(new Uint8Array(chunkData));
//     // }
// }

app.get('/', async (req, res) => {
    // console.log('HERE');
    const shared = req.query.shared;
    const filename = req.query.filename;

    if (shared) {
        // Very gud code but it only serve <80MB file:>>
        // const originalUrl = `https://ipfs.particle.network/${shared}`;

        // const options = {};

        // if (req.headers.range) {
        // options.headers = { Range: req.headers.range };
        // }

        // const originalReq = http.request(
        // originalUrl,
        // options,
        // async (originalRes) => {
        //     const links = [originalUrl];
        //     const fileSize = await getFileSize(links);

        //     const blob = []; // Để nhận dữ liệu trả về từ response

        //     originalRes.on("data", (chunk) => {
        //     blob.push(chunk);
        //     });

        //     originalRes.on("end", () => {
        //     const response = Buffer.concat(blob);

        //     res.writeHead(originalRes.statusCode, originalRes.headers);
        //     res.end(response);
        //     });
        // }
        // );

        // originalReq.end();

        // My code lol
        // Api for getting data cids
        const APIRES = await fetch(
            'https://www.ufsdrive.com/api/reqdata?shared=' + shared
        );

        if (!APIRES.ok) {
            // ctx.waitUntil(log("Get data fail"));
            APIRES.status(404).send('Not found');
        }

        const data = await APIRES.json();
        const file = data.data;

        // console.log(file);

        var siez;

        if (file.profile_picture != 'Multipart') {
            siez = await getFileSize([file.profile_picture]);
        } else {
            siez = await getFileSize(file.data);
        }

        // console.log(siez)

        var parts, start, end;
        if (req.headers.range != null) {
            // console.log(req.headers.range)
            parts = req.headers.range.replace(/bytes=/, '').split('-');
            start = parseInt(parts[0], 10);
            end = parts[1] ? parseInt(parts[1], 10) : siez - 1;
        }

        var headers = {
            'content-type': data.contentType,
            'Cache-Control': 'public, max-age=29030400',
            'Content-Disposition': `inline; filename="${filename ? filename : data.filename}"`,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Expose-Headers':
                'Content-Range, Content-Length, ETag, Access-Control-Allow-Methods, Access-Control-Allow-Origin',
            Vary: 'Origin, Access-Control-Request-Headers, Access-Control-Request-Method, Accept-Encoding',
            Connection: 'keep-alive',
            'Accept-Ranges': 'bytes'
        };

        // if requested has content-range header then we need to change the headers
        if (req.headers.range) {
            headers['Content-Range'] = `bytes ${start}-${end}/${siez}`;
            headers['Content-Length'] = end - start - 1;
        } else {
            headers['Content-Length'] = siez;
        }

        // console.log(headers);

        // res.set(headers);
        if(req.headers.range){
            res.writeHead(206, headers);
        } else {
            res.writeHead(200, headers);
        }

        if (req.headers.range) {
            // send only requested.
            // await log("Have range query")
            if (file.profile_picture != 'Multipart') {
                // await log('One File Query');
                const res2 = await fetch(
                    `https://ipfs.particle.network/${extractCID(
                        file.profile_picture
                    )}`,
                    {
                        method: 'GET',
                        headers: {
                            Range: req.headers.range
                        }
                    }
                );
                const blob = new Uint8Array(await res2.arrayBuffer());
                // controller.enqueue(blob);
                // controller.close();
                res.write(blob);
                res.end();
            } else {
                var content_range_start = start;
                var content_range_end = end;
                var current_range = 0;
            
                for (var cid of file.data) {
                    if (cid.includes('https://')) {
                        cid = extractCID(cid);
                    }
            
                    // Skip chunks completely outside the range
                    if (current_range + eachfilesize[cid] <= content_range_start) {
                        current_range += eachfilesize[cid];
                        continue;
                    }
            
                    // Calculate the starting byte within the current chunk
                    let start_byte = Math.max(content_range_start - current_range, 0);
            
                    // Calculate the number of bytes to fetch from this chunk
                    let bytes_to_fetch = Math.min(
                        eachfilesize[cid] - start_byte,
                        content_range_end - current_range
                    );
            
                    // Adjust the range for the fetch request
                    let fetch_start = start_byte;
                    let fetch_end = Math.min(start_byte + bytes_to_fetch, eachfilesize[cid] - 1);
            
                    const res2 = await fetch(
                        `https://ipfs.particle.network/${cid}`,
                        {
                            method: 'GET',
                            headers: {
                                'range': `bytes=${fetch_start}-${fetch_end}`
                            }
                        }
                    );

                    // Check if the response is partial content
                    if (res2.status === 206) { // 206 Partial Content
                        // Extract the Content-Range header
                        const contentRange = res2.headers.get('Content-Range');
                        // console.log(contentRange)

                        // Ensure the range matches the request
                        // if (rangeStart === fetch_start && rangeEnd === fetch_end) {
                            // Enqueue the received chunk
                            // controller.enqueue(new Uint8Array(await res.arrayBuffer()));
                        res.write(new Uint8Array(await res2.arrayBuffer()));

                        // } else {
                        //     // Handle unexpected range mismatch
                        //     console.error('Range mismatch in response');
                        // }
                    } else {
                        // Handle unexpected response status
                        console.error('Unexpected response status:', res2.status);
                    }
            
                    // // Enqueue the fetched data
                    // controller.enqueue(new Uint8Array(await res.arrayBuffer()));
            
                    // // Update the current range
                    // current_range += bytes_to_fetch;
            
                    // // Break if we've reached the end of the requested range
                    // if (current_range >= content_range_end) {
                    //     break;
                    // }

                    // Update the current range
                    current_range += bytes_to_fetch;

                    // Check if the end of the requested range has been reached
                    if (current_range >= content_range_end) {
                        // controller.close();
                        res.end();
                        break;
                    }
                }
            
                // controller.close();
                res.end();
            
            }
        } else {
            // await log("No range query")
            if (file.profile_picture != 'Multipart') {
                // siez = await getFileSize([file.profile_picture]);
                // log("Comsume data")
                const res2 = await fetch(
                    `https://ipfs.particle.network/${extractCID(
                        file.profile_picture
                    )}`
                );
                const blob = new Uint8Array(await res2.arrayBuffer());
                res.write(blob);
                res.end();
            } else {
                // siez = await getFileSize(file.data);
                // console.log('One MUL REq');
                for (var cid of file.data) {
                    if (cid.includes('https://')) {
                        cid = extractCID(cid);
                    }
                    // const res = await fetch(`https://ipfs.particle.network/${cid}`);
                    // const blob = new Uint8Array(await res.arrayBuffer());
                    // console.log('process ' + cid);
                    const response = await fetch(
                        `https://ipfs.particle.network/${cid}`
                    );

                    // console.log(response.headers.get('Content-Length'));

                    const blob = new Uint8Array(
                        await response.arrayBuffer()
                    );
                    // controller.enqueue(blob);
                    res.write(blob);
                    // await customFetch(
                    //     `https://ipfs.particle.network/${cid}`,
                    //     controller,
                    //     0,
                    //     eachfilesize[cid]
                    // );
                    // controller.enqueue(blob);
                }

                console.log('Done');

                res.end()
            }
        }
        // log("Success")
        // const tstream = new TransformStream();
        // // ctx.waitUntil(readable.pipeTo(tstream.writable));
        // await readable.pipeTo(tstream.writable)
        // log("Sended!")

        // if (req.headers.range) {
        //     res.status(206).send(readable);
        // } else {
        //     res.status(200).send(readable);
        // }

        // tstream.readable.pipeTo(res);
        // res.pipe(tstream.readable);
    } else {
        res.status(400).send('Missing shared or filename parameter');
    }
});

app.listen(5000, () => {
    console.log('Server started on port 5000');
});
