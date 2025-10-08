import { z } from "zod";
import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { meSchema } from "./schemes";

const userTags = ["users"] as const;
export const usersRoutes: FastifyPluginAsyncZod = async function (
    fastify,
    _opts,
) {
    // inline schema
    fastify.route({
        method: "GET",
        url: "/",
        // Define your schema
        schema: {
            querystring: z.object({
                name: z.string().min(4).optional(),
            }),
            tags: userTags,
            response: {
                200: z.string(),
            },
        },
        handler: (req, res) => {
            res.send(req.query.name);
        },
    });

    // importing schema
    fastify.get("/me/:name", {
        schema: {
            params: meSchema,
            tags: userTags,
            response: {
                200: z.string(),
            },
        },
    }, (req, res) => {
        res.send(req.params.name);
    });
};
