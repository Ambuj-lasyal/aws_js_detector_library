const express = require('express');
const app = express();
const axios = require('axios');
const fs = require('fs');
const port = 8080;
const ytdl = require('ytdl-core');
var youtubeThumbnail = require('youtube-thumbnail');
const yt = require("youtube-search-api");
const GVDS = require('get-video-duration');

function GetThumb(id) {
    var thumbnail = youtubeThumbnail('https://www.youtube.com/watch?v='+id);
    
    return thumbnail.high.url;
}


const BURL = 'https://www.googleapis.com/youtube/v3';
const apiK = 'AIzaSyBTpri6Ijefed6m8N48c7xGRReepfwrWc0';

app.get('/', async (req, res) => {
    const videos = await yt.GetSuggestData();
    let indx = 0;
    let HTML = '';
    const scrp = '<script>'+read('SCRP.js')+'</script>';
    const dhtml = '</center></body><style>'+read('style.css')+'</style>' + scrp;
    while(indx<videos.items.length){
        if(videos.items[indx].type == 'video'){
            let title = videos.items[indx].title;
            if(title.length>20){
                let idx = 0;
                let res = '';
                while(idx < 20-2){
                    res+=title[idx];
                    idx++;
                }
                title = res+' ..';
            }
            let id = videos.items[indx].id;
            let thumbnail = GetThumb(id);
            HTML += '<center><div class=IMG><br><img class="thumb" src="'+thumbnail+'" style="height: 50%; width: 100%;"><a href="/watch?v='+id+'"><h1>'+title+'</h1></a><br></div></center>';
        }
        indx++;
    }
    res.send('<div class="Nav"><h1><a id="Home" href="/search?q=&p=15">HomePage</a></h1><center><input placeholder="Search" id="SB"><button onclick="search()">Search</button><br><br></center></div><center>'+HTML + dhtml);
});

function read(filepath){
    let data = fs.readFileSync(filepath).toString();
    return data;
}

app.get('/search', async (req, res) => {
    const searchQ = req.query.q;
    if(searchQ.match(/^ *$/) === null){
        const url = BURL + '/search?key='+apiK+'&type=video&part=snippet&q='+searchQ+'&maxResults=15';
        const response = await axios.get(url);
        let indx = 0;
        let perP = 15;
        let thumbnail = '';
        let title = '';
        let HTML = read('index.html');
        while(indx<perP){
            title = response.data.items[indx].snippet.title;
            if(title.length>30){
                let idx = 0;
                let res = '';
                while(idx < 30-3){
                    res+=title[idx];
                    idx++;
                }
                title = res+' ..';
            }
            thumbnail = GetThumb(response.data.items[indx].id.videoId);
            HTML += ('<center><div class=IMG><br><img class="thumb" src="'+thumbnail+'" style="height: 180px; width: 320px;"><br><a href=/watch?v='+response.data.items[indx].id.videoId+'<h4>'+title+'</h4></a></div>');
            indx++;
        }
        const scrp = '<script>'+read('SCRP.js')+'</script>';
        const dhtml = '</center></body><style>'+read('style.css')+'</style>' + scrp;
        res.send('<div class="Nav"><h1><a id="Home" href="/search?q=&p=15">HomePage</a></h1><center><input placeholder="Search" id="SB"><button onclick="search()">Search</button><br><br></center></div>'+HTML+dhtml);
    }else{
        res.redirect('/')
    }
});

app.get('/s', async (req, res)=>{
    const searchQ = req.query.q;
    const videos = await yt.GetListByKeyword(searchQ, false, 100);
    let indx = 0;
    let HTML = '';
    const scrp = '<script>'+read('SCRP.js')+'</script>';
    const dhtml = '</center></body><style>'+read('style.css')+'</style>' + scrp;
    while(indx<videos.items.length){
        if(videos.items[indx].type == 'video'){
            let title = videos.items[indx].title;
            if(title.length>20){
                let idx = 0;
                let res = '';
                while(idx < 20-3){
                    res+=title[idx];
                    idx++;
                }
                title = res+' ..';
            }
            let id = videos.items[indx].id;
            let thumbnail = GetThumb(id);
            HTML += '<center><div class=IMG><br><img class="thumb" src="'+thumbnail+'" style="height: 50%; width: 100%;"><a href="/watch?v='+id+'"><h1>'+title+'</h1></a><br></div></center>';
        }
        indx++;
    }
    res.send('<div class="Nav"><h1><a id="Home" href="/search?q=&p=15">HomePage</a></h1><center><input placeholder="Search" id="SB"><button onclick="search()">Search</button><br><br></center></div><center>'+HTML + dhtml);
});

app.get('/video', (req, res) => {
    const id = req.query.v;
    const videoPath = __dirname+'/'+id+'.mp4';
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
  
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  });

app.get('/watch', async (req, res, next)=>{
    const id = req.query.v;
    let rd = false;
    const de = await (await ytdl.getInfo('https://www.youtube.com/watch?v='+id)).videoDetails;
    if(fs.existsSync(id+'.mp4')){
        const dd = await GVDS.getVideoDurationInSeconds(id+'.mp4');
        console.log(dd);
        console.log(de.lengthSeconds);
        if((de.lengthSeconds - 2) < dd){
            rd = true;
        }
    }
    const sugg = await yt.GetVideoDetails(id);
    let CSS = read('style.css');
    let SC = read('SCRP.js');
    if(rd){
        try {
            console.log('Streaming the video with id: '+id)
            const vid = '<video id="VD" src="/video?v='+id+'"oncanplay="startVideo()" onended="stopTimeline()"autobuffer="true" controls></video>'
            const sub = de.author.subscriber_count;
            let sug = '';
            let indx = 0;
            let sT = '';
            console.log(de);
            while(indx<sugg.suggestion.length){
                sT = sugg.suggestion[indx].title;
                sug+='<img class="Sthumb" src="'+sugg.suggestion[indx].thumbnail[sugg.suggestion[indx].thumbnail.length-1].url+'"><a href="/watch?v='+sugg.suggestion[indx].id+'"><h4 class="Stitle">'+sT+'</h4></a><br>'
                indx++;
            }
            let ds = de.description;
            const HTML = read('VidH.html') +'<title>MTube - '+de.title+'</title></head><body><div class="Lpanel">'+ vid +'<h1>'+de.title+'</h1><br><img class="Cthumb" src="'+de.author.thumbnails[de.author.thumbnails.length-1].url+'"><h2>'+de.author.name+'</h2><p>'+sub+' Subscribers</p><br><br><div class="desc">'+ds+'</div></div></div><div class="Rpanel">'+sug+'</div></body><style>'+CSS+'</style><script>'+SC+'</script>' + '</html>';
            res.send(HTML);
        } catch (error) {
            console.log(error);
        }
    }else{
        ytdl('https://www.youtube.com/watch?v='+id, { filter: format => format.container === 'mp4', quality:'18'}).pipe(fs.createWriteStream(id+'.mp4')).on("finish",async function(){
            console.log('\x1b[35mFinished downloading \x1b[37m');
            res.redirect('/watch?v='+id);
        });
    }
});

app.get('/downloads', async (req, res)=>{
    res.send('<center><h1>Coming Soon</h1><style>*{font-family:rubik,sans-serif;color: #dfdfdf;background: #0f0f0f;}</style>')
});

app.get('/channel', async(req, res)=>{
    res.send('<center><h1>Coming Soon</h1><style>*{font-family:rubik,sans-serif;color: #dfdfdf;background: #0f0f0f;}</style>')
});

app.listen(port, () => {
    console.log('\x1b[35mConnected to port: '+port+'\x1b[37m');
});
