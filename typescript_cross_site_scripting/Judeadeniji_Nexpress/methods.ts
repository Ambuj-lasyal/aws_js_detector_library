import { ParsedPath } from "node:path";
import { Request, Response } from "express";
import { ROUTE_CONFIG } from "./const.js";
import { MethodExport } from "./types.js";
import { cleanString } from "./html/utils.js";
import { global_ctx } from "./server_context/context.js"
//import { renderToReadableStream } from "./jsx/index.js"
import { jsx } from "./jsx.experimental/jsx-runtime.js";
import { renderToStream } from "./jsx.experimental/index.js"
import { html as html$$ } from "./html/index.js"


export function isCjs() {
    return typeof module !== "undefined" && !!module?.exports;
}

export async function renderElement(element: any,props: { req: Request, res: Response }, toStream) {
    const { req, res } = props
    global_ctx.req = req
    global_ctx.res = res
    const j = jsx(element, {
        path: req.route.path,
        params: req.params,
        url: req.url,
        query: req.query,
        body: req.body,
        method: req.method,
        rawHeaders: req.rawHeaders,
        headers: req.headers,
        children: [/* support for injected children */]
    });
    
    res.setHeader('Content-Type', 'text/html');
    if (toStream) {
      res.setHeader('Transfer-Encoding', 'chunked');
      const stream = renderToStream(j);
      stream.pipe(res)
    } else {
      res.write(await j.toString())
      res.end()
    }
    //res.send(cleanString(html$$(html.toString())));
}

export function buildRoute(parsedFile: ParsedPath) {
    const directory = parsedFile.dir === parsedFile.root ? "" : parsedFile.dir;
    const name = parsedFile.name.startsWith("route")
        ? parsedFile.name.replace("route", "")
        : parsedFile.name.startsWith("page")
          ? parsedFile.name.replace("page", "")
          : parsedFile.name;

    return directory + name;
}

export function buildUrl(path: string) {
    const url = convertParamSyntax(path);
    return url.replace(/:\.\.\.\w+/g, "*");
}

export function convertParamSyntax(path: string) {
    const subpaths: string[] = [];

    for (const subpath of path.split("/")) {
        subpaths.push(transformBrackets(subpath));
    }

    return mergePaths(...subpaths);
}

export function mergePaths(...paths: string[]) {
    return (
        "/" +
        paths
            .map((path) => path.replace(/^\/|\/$/g, ""))
            .filter((path) => path !== "")
            .join("/")
    );
}

export function transformBrackets(value: string) {
    const regBrackets = /\[([^}]*)\]/g;
    return regBrackets.test(value)
        ? value.replace(regBrackets, (_, s) => `:${s}`)
        : value;
}

export function calculatePriority(url: string) {
    const depth = url.match(/\/.+?/g)?.length || 0;
    const specifity = url.match(/\/:.+?/g)?.length || 0;
    const catchall = url.match(/\/\*/g)?.length || 0 > 0 ? Infinity : 0;

    return depth + specifity + catchall;
}

export function getMethodKey(method: string) {
    const key = method.toLowerCase();
    if (key === "del") return "delete";
    return key;
}

export function isFileIgnored(parsedFile: ParsedPath) {
    return (
        !ROUTE_CONFIG.VALID_FILE_EXTENSIONS.includes(
            parsedFile.ext.toLowerCase() as any
        ) ||
        ROUTE_CONFIG.INVALID_NAME_SUFFIXES.some((suffix) =>
            parsedFile.base.toLowerCase().endsWith(suffix)
        ) ||
        parsedFile.name.startsWith(ROUTE_CONFIG.IGNORE_PREFIX_CHAR) ||
        parsedFile.dir.startsWith(`/${ROUTE_CONFIG.IGNORE_PREFIX_CHAR}`)
    );
}

export function isHandler(handler: unknown): handler is MethodExport {
    return typeof handler === "function" || Array.isArray(handler) && handler.every((h) => typeof h === "function");
}

export function getHandler(handler: MethodExport) {
    if (Array.isArray(handler) && handler.every((h) => typeof h === "function"))
        return handler;
    else if (typeof handler === "function") return [handler];
    else return [];
}
