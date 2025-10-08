import express from "express";
import * as MW from "app/modules/damage/mathWorker.js";
import { getAverageDamage } from "app/modules/damage/mathWorker.js";
import { readFileSync } from "fs";
import { DamageInfo } from "~/modules/damage/mathTypes";
const app = express();
const PORT = 10022;

// async def gen_embed(
//     title: str = "zeax",
//     og_type: str = "zeax:default",
//     url: str = "http://x.ze.ax",
//     image_url: str = None,
//     image_size: ty.Optional[ty.Tuple[int, int]] = None,
//     description: str = "",
//     audio_url: str = None,
//     video_url: str = None
// ) -> web.Response:
//  head = f"<head>"
//  body = f"<body>"
//  if description and len(description) > 200:
//     async with clientSession.post("https://h.ze.ax/documents", data=description) as resp:
//        description = (await resp.json(content_type=None))["key"]

//  head += (f"<meta property='og:title' content='{title}' />\n"
//           f"<meta property='og:type' content='{og_type}' />\n"
//           f"<meta property='og:url' content='{url}' />\n")
//  if image_url:
//     head += (f"<meta property='og:image:type' content='image/jpeg'/>\n"
//              f"<meta property='og:image' content='{image_url}' />\n"
//              f"<meta property='twitter:image' content='{image_url}' />\n"
//              f"<meta property='twitter:card' content='summary_large_image'>")
//     body += f"<img src='{image_url}'/>"
//     if image_size:
//        head += (f"<meta property='og:image:width' content='{image_size[0]}'/>\n"
//                 f"<meta property='og:image:height' content='{image_size[1]}' />\n")
//  if description:
//     head += f"<meta property='og:description' content='{description}' />\n"
//  if audio_url:
//     head += f"<meta property='og:audio' content='{audio_url}' />\n"
//  if video_url:
//     head += f"<meta property='og:video' content='{video_url}' />\n"
//  head += "</head>"
//  body += "</body>"
//  return web.Response(text=head + body, content_type="text/html")

const gen_embed = async ({
    title = "q",
    og_type = "q:default",
    url = "http://q.cephalon.xyz",
    image_url,
    image_size,
    description = "",
    audio_url,
    video_url,
    body_extra = "",
}: {
    title?: string;
    og_type?: string;
    url?: string;
    image_url?: string;
    image_size?: [number, number];
    description?: string;
    audio_url?: string;
    video_url?: string;
    body_extra?: string;
} = {}) => {
    let head = "<head>";
    let body = "<body>";

    head += `<meta property='og:title' content='${title}' />\n`;
    head += `<meta property='og:type' content='${og_type}' />\n`;
    head += `<meta property='og:url' content='${url}' />\n`;
    if (image_url) {
        head += `<meta property='og:image:type' content='image/jpeg'/>\n`;
        head += `<meta property='og:image' content='${image_url}' />\n`;
        head += `<meta property='twitter:image' content='${image_url}' />\n`;
        head += `<meta property='twitter:card' content='summary_large_image'>`;
        body += `<img src='${image_url}'/>`;
        if (image_size) {
            head += `<meta property='og:image:width' content='${image_size[0]}'/>\n`;
            head += `<meta property='og:image:height' content='${image_size[1]}' />\n`;
        }
    }
    if (description) {
        head += `<meta property='og:description' content='${description}' />\n`;
        body += `<p>${description.replaceAll("\n", "<br>")}</p>\n`;
        body += `${body_extra}\n`;
    }
    if (audio_url) {
        head += `<meta property='og:audio' content='${audio_url}' />\n`;
    }
    if (video_url) {
        head += `<meta property='og:video' content='${video_url}' />\n`;
    }
    head += "</head>";
    body += "</body>";
    return head + body;
};

app.use(express.static("public"));

app.get("/dmg", async (req, res) => {
    const ac = req.query.ac?.toString() ?? "10";
    const dmg = req.query.dmg?.toString().replaceAll(" ", "+");
    const count = req.query.count?.toString();
    const hitbonus = req.query.hitbonus?.toString();
    const critFaces = req.query.critFaces?.toString();
    const gwf = req.query.gwf?.toString();

    const adv = req.query.adv?.toString();
    if (!dmg) {
        res.status(400).send("ac and dmg are required");
        return;
    }

    const damageArgs: DamageInfo = {
        damage: [dmg],
        damageOnFirstHit: "",
        damageOnMiss: "",
        attack: hitbonus ? [hitbonus] : ["0"],
        attackCount: count ? parseInt(count) : 1,
        critFaceCount: critFaces ? parseInt(critFaces) : 1,
        damageFeatures: {
            greatWeaponFighting: !!gwf,
            elementalAdept: false,
        },
        hitMods: {
            advantage: adv ? parseInt(adv) : 0,
            lucky: false,
        },
        metadata: {
            ac: parseInt(ac, 10)
        }
    }
    console.log({ damageArgs })
    const x = MW.parseFastAttackRoll(damageArgs.attack.join("+")) ? MW.computeDamageResult(damageArgs) : undefined;

    let body_extra = `
    <script type="module">
            var damageArgs = ${JSON.stringify(damageArgs)};
            ${readFileSync("./public/client/qClient.js", "utf-8")}
    </script><div id="rawDamageContainer"></div>`
    res.send(
        await gen_embed({
            description: `<b>AC:</b> ${ac}\b<b>Hit Bonus:</b> ${hitbonus || 0}\n<b>Damage Dice:</b> ${dmg}\n<b>Average Base Damage:</b> ${x?.averageDamage.toString(4) || "<Open Page>"}\n<b>Damage at AC ${ac}</b>: ${MW.weighted_mean_pmf(x?.finalDamagePMF.get(parseInt(ac, 10))!) || "<Open Page>"}`,
            body_extra
        }),
    );
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
