import express from "express"
import { addtofavourite,deleteTestimonial,getTestimonials, getgraphdata, gettestimonial, submitTestimonial } from "../controllers/Testimonial/Testimonial"
import { uploadmiddleware } from "../middlewares/uploadmiddleware"
import { authmiddleware } from "../middlewares/authmiddleware"
import { embedsingletestimonial, embedsingletypetestimonial, embedwalloflove } from "../controllers/Testimonial/Embedtestimonial"

const reviewRouter=express.Router()

reviewRouter.get('/:slug',authmiddleware,getTestimonials)
reviewRouter.get('/graph/data',authmiddleware,getgraphdata)
reviewRouter.get('/testimonial/:id',gettestimonial)
reviewRouter.get('/embedsingle/:id',embedsingletestimonial)
// @ts-ignore
reviewRouter.get('/walloflove/:slug/:layout',embedwalloflove)
// @ts-ignore
reviewRouter.get('/embed/:slug/:type',embedsingletypetestimonial)

reviewRouter.post('/:slug/submit',uploadmiddleware,submitTestimonial)
reviewRouter.patch('/:id/addtofavourite',authmiddleware,addtofavourite)

reviewRouter.delete('/:id',authmiddleware,deleteTestimonial)

reviewRouter.get('/embed/:slug/:layout/embed.js', (req, res) => {
    const { slug, layout } = req.params;
  
    const jsCode = `
      (function() {
        var container = document.getElementById('gimme-feedbacks-embed-root');
        if (!container) return;
        fetch("${process.env.BACKEND_URL}/review/walloflove/${slug}/${layout}")
          .then(r => r.text())
          .then(html => {
            container.innerHTML = html;
          });
      })();
    `;
    
    res.setHeader("Content-Type", "application/javascript");
    console.log(jsCode)
    res.send(jsCode);
  });

  
export default reviewRouter