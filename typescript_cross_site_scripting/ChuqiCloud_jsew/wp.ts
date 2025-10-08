/**
 * jsew wordpress回源
 * @copyright Acmecloud Group
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
const fetch = require('node-fetch');
const mime = require('mime-types');
const { minify } = require('terser');
const uglifycss = require('uglifycss');
const { ban } = require('../ban.js');

// WordPress 官方 API 地址
const WP_API = 'https://api.wordpress.org';
// 最大文件大小限制 (20MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default async function (req: VercelRequest, res: VercelResponse) {
    const { file } = req.query;

    // 基础路径校验
    if (!file || typeof file !== 'string') {
        return errorResponse(res, 400, 'Missing path parameter (CKY#WPCDN)');
    }

    // 封禁列表检查
    for (const item of ban) {
        if (item.match.test(file) && item.ban && Date.now() < item.expire) {
            return errorResponse(res, 403, item.msg);
        }
    }

    // 解析路径结构：(plugins|themes)/:name/(tags|branches)?/:version/:file
    const pathMatch = file.match(/^(plugins|themes)\/([^/]+)(?:\/(tags|branches))?\/([^/]+)\/(.+)/);
    if (!pathMatch) {
        return errorResponse(res, 400, 'Invalid path format (CKY#WPCDN)');
    }
    

    const [_, type, name, svnDir, version, filePath] = pathMatch;
    const isPlugin = type === 'plugins';

    try {
        // 版本号解析逻辑
        let resolvedVersion = await resolveWPVersion({
            type,
            name,
            version,
            isPlugin
        });

        // 构建源站 URL
        const originUrl = buildOriginUrl({
            type,
            name,
            version: resolvedVersion,
            filePath,
            svnDir
        });

        // 获取文件内容
        const fileRes = await fetch(originUrl);

        // 处理 404 响应
        if (fileRes.status === 404) {
            return handleMissingFile(res, {
                type,
                name,
                version: resolvedVersion,
                filePath,
                originUrl
            });
        }

        // 检查文件大小
        const contentLength = fileRes.headers.get('content-length');
        if (+(contentLength || 0) > MAX_FILE_SIZE) {
            return errorResponse(res, 413, 'File too large (CKY#WPCDN)');
        }

        // 处理内容类型
        const contentType = getContentType(filePath);

        // 缓存控制策略
        setCacheHeaders(res, version);

        // 返回文件内容
        const buffer = await fileRes.buffer();
        res.setHeader('Content-Type', contentType);
        res.setHeader('X-WPCDN-Source', originUrl);
        res.send(buffer);

    } catch (error) {
        console.error('WPCDN Error:', error);
        return errorResponse(res, 500, 'Internal Server Error (CKY#WPCDN)');
    }
}

/** 构建源站 URL */
function buildOriginUrl(params: {
    type: string;
    name: string;
    version: string;
    filePath: string;
    svnDir?: string;
}): string {
    const { type, name, version, filePath, svnDir } = params;

    // 如果 svnDir 存在（即 tags 或 branches），则保留它
    const dirPrefix = svnDir ? `${svnDir}/` : '';

    return `https://cdn.jsdelivr.net/wp/${type}/${name}/${dirPrefix}${version}/${filePath}`;
}
/** 核心功能函数 */
async function resolveWPVersion(params: {
    type: string;
    name: string;
    version: string;
    isPlugin: boolean;
}): Promise<string> {
    const { version, name, isPlugin } = params;

    // 处理特殊版本标识
    if (version === 'trunk') return 'trunk';
    if (version === 'stable') {
        const apiUrl = `${WP_API}/${isPlugin ? 'plugins' : 'themes'}/info/1.2/?action=${isPlugin ? 'plugin_information' : 'theme_information'}&request[slug]=${name}`;
        const info = await fetch(apiUrl).then(r => r.json());
        return info.version;
    }

    // 处理语义化版本
    if (/\d+\.\d+/.test(version)) {
        const versions = await getAvailableVersions(name, isPlugin);
        const matched = findBestVersionMatch(version, versions);
        return matched || version;
    }

    return version;
}

async function getAvailableVersions(name: string, isPlugin: boolean): Promise<string[]> {
    const svnUrl = isPlugin
        ? `https://plugins.svn.wordpress.org/${name}/tags/`
        : `https://themes.svn.wordpress.org/${name}/tags/`;

    const res = await fetch(svnUrl);
    const html = await res.text();
    return [...html.matchAll(/<li><a href="(\d+\.\d+(\.\d+)?)\/">/g)]
        .map(m => m[1])
        .filter(v => v !== 'tags' && v !== 'trunk');
}

function findBestVersionMatch(target: string, versions: string[]): string | null {
    const targetParts = target.split('.');
    return versions
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .find(v => {
            const vParts = v.split('.');
            return targetParts.every((p, i) => p === vParts[i]);
        }) || null;
}

/** 辅助功能函数 */
async function handleMissingFile(
    res: VercelResponse,
    params: {
        type: string;
        name: string;
        version: string;
        filePath: string;
        originUrl: string;
    }
) {
    // 自动压缩处理
    if (params.filePath.endsWith('.min.js')) {
        const sourceUrl = params.originUrl.replace('.min.js', '.js');
        const sourceRes = await fetch(sourceUrl);
        if (sourceRes.ok) {
            const source = await sourceRes.text();
            const minified = await minify(source);
            res.setHeader('X-WPCDN-Minified', 'true');
            return res.send(`/* Auto-minified by WPCDN */\n${minified.code}`);
        }
    }

    if (params.filePath.endsWith('.min.css')) {
        const sourceUrl = params.originUrl.replace('.min.css', '.css');
        const sourceRes = await fetch(sourceUrl);
        if (sourceRes.ok) {
            const source = await sourceRes.text();
            res.setHeader('X-WPCDN-Minified', 'true');
            return res.send(uglifycss.processString(source));
        }
    }

    return errorResponse(res, 404, `File not found: ${params.filePath} (CKY#WPCDN)`);
}

function setCacheHeaders(res: VercelResponse, version: string) {
    const isStable = version === 'stable' || /^\d+\.\d+\.\d+$/.test(version);
    res.setHeader(
        'Cache-Control',
        `public, max-age=${isStable ? 2592000 : 600}, s-maxage=${isStable ? 31536000 : 1800}`
    );
}

function getContentType(filePath: string): string {
    const typeMap: Record<string, string> = {
        '.php': 'text/plain', // 安全考虑不直接执行 PHP
        '.mo': 'application/octet-stream',
        '.pot': 'text/plain'
    };
    const ext = filePath.slice(filePath.lastIndexOf('.'));
    return typeMap[ext] || mime.lookup(filePath) || 'text/plain';
}

function errorResponse(res: VercelResponse, code: number, message: string) {
    res.status(code).setHeader('Content-Type', 'text/plain; charset=utf-8').send(message);
}