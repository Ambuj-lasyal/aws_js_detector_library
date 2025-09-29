const express = require('express');
const queue = require('express-queue');
const multer = require('multer');
const exif = require('jpeg-exif');
const fs = require('fs');
const sharp = require('sharp');
const cors = require("cors");

if (!fs.existsSync('uploads')){
    fs.mkdirSync('uploads');
}

const app = express();
app.use(queue({ activeLimit: 15, queuedLimit: -1 }));
app.use(express.json());
var corsOptions = {
    origin: "*"
};
app.use(cors(corsOptions));

app.use(express.urlencoded({ extended: false }));
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.post('/api/image-upload', upload.any('image'), (req, res) => {
    /**
     * Receives a POST request, containing 'image' as key and the bundle of images as value.
     * Saves the images in 'uploads/', adding Date.now() to the start of the name to avoid duplicates.
     * Creates/Adds to 'uploads/GPSInfo.json' file, which contains the image names for keys and only the GPS EXIF data for values.
     * Calls the createThumb() function for the thumbnail creation.
     */

    const path = require('path');

    req.files.forEach(file => {
        var metadata = exif.parseSync(file.path).GPSInfo;
        if (!metadata || !metadata.GPSLatitudeRef || !metadata.GPSLatitude || !metadata.GPSLongitudeRef || !metadata.GPSLongitude) {
            console.log(`No GPS data found in ${file.path}`);
            return;
        }
        try {
            var gpsfile = JSON.parse(fs.readFileSync('uploads/GPSInfo.json'));
        } catch (e) {
            var gpsfile = {}
        }
        gpsfile[path.basename(file.path)] = {
            "latitude" : degreesToDecimal([metadata.GPSLatitudeRef, ...metadata.GPSLatitude]),
            "longitude": degreesToDecimal([metadata.GPSLongitudeRef, ...metadata.GPSLongitude])
        }
        fs.writeFileSync('uploads/GPSInfo.json', JSON.stringify(gpsfile), function (err) {
            if (err) throw err;
        });
        createThumb(file.path);
    })

    res.send({ "status": 200, "error": null, "response": "Uploaded successfully!" });
});

app.get('/api/get-images', (req, res) => {
    /**
     * Receives a get request with no additional data.
     * Returns an array of the names of only the original images.
     */
    fs.readdir('uploads', (error, files) => {
        images = [];
        files.forEach(n => {
            if (!n.includes('.json') && !n.includes("thumbnail")) {
                images.push(n)
            };
        });

        res.send(images);
    });
});

app.get('/api/get-images-by-coordinates/', (req, res) => {
    /**
     * Receives GET request, querying for images inside a geographical bounding box.
     * Returns all image names which fit within the box.
     */
    var latitudeStart = degreesToDecimal(req.query.la1.split('_'));
    var latitudeEnd = degreesToDecimal(req.query.la2.split('_'));
    var longitudeStart = degreesToDecimal(req.query.lo1.split('_'));
    var longitudeEnd = degreesToDecimal(req.query.lo2.split('_'));
    var gpsfile = JSON.parse(fs.readFileSync('uploads/GPSInfo.json'));
    var qualifyingImages = []
    for (var attribute in gpsfile) {
        var decimalLat = gpsfile[attribute]["latitude"]
        var decimalLon = gpsfile[attribute]["longitude"]
        if (latitudeStart <= decimalLat && decimalLat <= latitudeEnd && longitudeStart <= decimalLon && decimalLon <= longitudeEnd) {
            qualifyingImages.push(attribute)
        }
    }
    res.send({ "body": qualifyingImages })
});

app.get('/api/get-image/:imageName', (req, res) => {
    /**
     * Receives a GET request with the name of the desired image (with extension) and returns links/directories for the original image and its tumbnail.
     */
    var imageName = req.params.imageName;
    if (fs.existsSync("uploads/" + imageName) && !imageName.includes('.json')) {
        res.send({ "fullimg": __dirname + "\\uploads\\" + imageName, "thmbimg": __dirname + "\\uploads\\" + imageName.split('.')[0] + "-thumbnail." + imageName.split('.')[1] });
    } else {
        res.send("File does not exist!");
    }
});

app.post('/api/image-deletion/', (req, res) => {
    /**
     * Receives a POST request, containing a json in the body, with  "forDeletion" as key and an array with image names (without extension) for value.
     * Deletes both the original image and the thumbnail, as well as the data from "uploads/GPSInfo.json".
     */
    var imagesForDeletion = req.body.forDeletion;
    for (var image in imagesForDeletion) {
        fs.unlink("uploads/" + imagesForDeletion[image], (err => {
            if (err) console.log(err)
        }));
        fs.unlink("uploads/" + imagesForDeletion[image].split('.')[0] + "-thumbnail." + imagesForDeletion[image].split('.')[1], (err => {
            if (err) console.log(err)
        }));
        var gpsfile = JSON.parse(fs.readFileSync('uploads/GPSInfo.json'));
        delete gpsfile[imagesForDeletion[image]];
        fs.writeFileSync('uploads/GPSInfo.json', JSON.stringify(gpsfile), function (err) {
            if (err) throw err;
        });
    }
    res.send({ "status": 200, "error": null, "response": "Request recieved!" });
});

function degreesToDecimal(degrees) {
    /**
     * Converts the degrees, minutes and seconds to degrees with a decimal point.
     * Accepts an array of [E/W/N/S position, degrees, minutes, seconds] and returns a number.
     */
    let result = Number(degrees[1]) + Number(degrees[2] / 60) + Number(degrees[3] / 3600);
    if (degrees[0] == 'N' || degrees[0] == 'E') {
        return result;
    } else {
        return -result;
    }
};

async function createThumb(path) {
    /**
     * Creates a thumbnail of a given image, using 256px for the upper limit of the bigger dimention. The other dimention is calculated to maintain the ratio.
     * Thumbnails also are created with the EXIF data of the original image, in order to maintain the orientation and GPS information.
     */
    try {
        await sharp(path)
            .resize({
                width: 256,
                height: 256,
                fit: 'inside'
            })
            .withMetadata()
            .toFile(path.split('.')[0] + "-thumbnail." + path.split('.')[1]);
    } catch (err) {
        console.log(err)
    }
}

app.listen(3000, () => {
    console.log('Server started on port 3000...');
});