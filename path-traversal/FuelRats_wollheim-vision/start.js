"use strict";

const express = require("express"),
	path = require("path"),
	fs = require("fs"),
	crypto = require("crypto"),
	imageThumbnail = require("image-thumbnail");

/* Loading pages */

const layout_head = require("./views/includes/layout_head"),
	layout_footer = require("./views/includes/layout_footer");

const index = require("./views/index"),
	screenshots = require("./views/screenshots");

const app = express();

app.set("views", "views");
app.use(express.static("public"));

const galleryImagesPath = process.env.GALLERYPATH || "public/testimages";
const galleryThumbnailPath = process.env.THUMBNAILPATH || "public/thumbnails";

app.use("/images/screenshots", express.static(galleryImagesPath));

app.get("/", function(req, res) {
	res.send(
		index({
			layout_head: layout_head({
				title: "Home"
			}),
			layout_footer: layout_footer()
		})
	);
});

function walkSync(dir, filelist = []) {
	fs.readdirSync(dir).forEach(file => {
		const dirFile = path.join(dir, file);
		try {
			filelist = walkSync(dirFile, filelist);
		} catch (err) {
			if (err.code === "ENOTDIR" || err.code === "EBUSY")
				filelist = [...filelist, dirFile];
			else throw err;
		}
	});
	return filelist;
}

app.get("/upload", function(req, res) {
	res.redirect("https://fuelrats.cloud/s/eXqRPLAGfdZCMr4");
});

app.get("/tools", function(req, res) {
	res.send("Not yet, but soon&trade;.");
});

app.get("/screenshots/:page?", function(req, res) {
	let currentPage = req.params.page ? req.params.page : 1;
	const fileList = walkSync(galleryImagesPath);

	res.send(
		screenshots({
			layout_head: layout_head({
				title: "Screenshot gallery",
				head: /*html*/ `
<link href="/lightbox2/css/lightbox.min.css" rel="stylesheet" />`
			}),
			currentPage,
			fileList,
			galleryImagesPath,
			layout_footer: layout_footer()
		})
	);
});

app.get("/images/screenshots/thumbnails/:originalFileName", function(req, res) {
	const origFileName = req.params.originalFileName;
	let hash = crypto
		.createHash("md5")
		.update(origFileName)
		.digest("hex");

	const thumbFile = path.join(
		galleryThumbnailPath,
		hash + path.extname(origFileName)
	);
	if (fs.existsSync(thumbFile)) {
		res.send(fs.readFileSync(thumbFile));
	} else {
		const origPath = path.join(galleryImagesPath, origFileName);

		imageThumbnail(origPath, {
			height: 138,
			width: 400
		}).then(thumb => {
			fs.writeFileSync(thumbFile, thumb);
			res.send(thumb);
		});
	}
});

app.get("/videos/background.webm", function(req, res) {
	const path = "./public/videos/wollheim.webm";
	const stat = fs.statSync(path);
	const fileSize = stat.size;
	const range = req.headers.range;
	if (range) {
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
		const chunksize = end - start + 1;
		const file = fs.createReadStream(path, {
			start,
			end
		});
		const head = {
			"Content-Range": `bytes ${start}-${end}/${fileSize}`,
			"Accept-Ranges": "bytes",
			"Content-Length": chunksize,
			"Content-Type": "video/webm"
		};
		res.writeHead(206, head);
		file.pipe(res);
	} else {
		const head = {
			"Content-Length": fileSize,
			"Content-Type": "video/webm"
		};
		res.writeHead(200, head);
		fs.createReadStream(path).pipe(res);
	}
});

app.get("/videos/background.mp4", function(req, res) {
	const path = "./public/videos/wollheim_background_video_no_sound.mp4";
	const stat = fs.statSync(path);
	const fileSize = stat.size;
	const range = req.headers.range;
	if (range) {
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
		const chunksize = end - start + 1;
		const file = fs.createReadStream(path, {
			start,
			end
		});
		const head = {
			"Content-Range": `bytes ${start}-${end}/${fileSize}`,
			"Accept-Ranges": "bytes",
			"Content-Length": chunksize,
			"Content-Type": "video/mp4"
		};
		res.writeHead(206, head);
		file.pipe(res);
	} else {
		const head = {
			"Content-Length": fileSize,
			"Content-Type": "video/mp4"
		};
		res.writeHead(200, head);
		fs.createReadStream(path).pipe(res);
	}
});

app.set("trust proxy", true);

app.listen(process.env.PORT || 3003);
