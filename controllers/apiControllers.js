import axios from "axios";

const sanitizeString = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[<+=->;'"&]/g, '').substring(0, 100);
};

const validateNumber = (num) => {
    const parsed = parseInt(num, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : Math.min(parsed, 1000);
};

const axiosConfig = {
    timeout: 10000,
    headers: {
        'User-Agent': 'WappyApp/1.0'
    }
};

export const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const getCachedResponse = (key) => {
    const cached = responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    responseCache.delete(key);
    return null;
};

const setCachedResponse = (key, data) => {
    responseCache.set(key, {
        data,
        timestamp: Date.now()
    });
};

const validateApiConfig = () => {
    if (!process.env.TENOR_API_KEY) {
        throw new Error('TENOR_API_KEY is not configured');
    }
};

export const getTenorTrendings = async (req, res) => {
    try {
        validateApiConfig();

        const { next } = req.body;
        const sanitizedNext = sanitizeString(next);

        const cacheKey = `tenor_trending_${sanitizedNext}`;
        const cached = getCachedResponse(cacheKey);

        if (cached) {
            return res.status(200).json({ tenor: cached });
        }

        const baseUrl = 'https://g.tenor.com/v1/trending';
        const params = new URLSearchParams({
            key: process.env.TENOR_API_KEY,
            limit: '15',
            ...(sanitizedNext && { pos: sanitizedNext })
        });

        const searchList = await axios.get(`${baseUrl}?${params}`, axiosConfig);

        setCachedResponse(cacheKey, searchList.data);

        res.status(200).json({ tenor: searchList.data });
    } catch (error) {
        console.error('Tenor trending error:', error.message);

        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ error: 'Request timeout' });
        }

        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'Unable to fetch trending content'
        });
    }
};

export const getTenorSearch = async (req, res) => {
    try {
        validateApiConfig();

        const { page, query } = req.body;
        const sanitizedQuery = sanitizeString(query);
        const validatedPage = validateNumber(page);

        if (!sanitizedQuery) {
            return res.status(400).json({ error: 'Invalid search query' });
        }

        const cacheKey = `tenor_search_${sanitizedQuery}_${validatedPage}`;
        const cached = getCachedResponse(cacheKey);

        if (cached) {
            return res.status(200).json({ tenor: cached });
        }

        const params = new URLSearchParams({
            q: sanitizedQuery,
            key: process.env.TENOR_API_KEY,
            limit: '15',
            pos: (validatedPage * 20).toString()
        });

        const searchList = await axios.get(
            `https://g.tenor.com/v1/search?${params}`,
            axiosConfig
        );

        setCachedResponse(cacheKey, searchList.data.results);

        res.status(200).json({ tenor: searchList.data.results });
    } catch (error) {
        console.error('Tenor search error:', error.message);

        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ error: 'Request timeout' });
        }

        if (error.code == 'ERR_NOCK_NO_MATCH') {
            return res.status(200).json({ tenor: [] });
        }

        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'Search service temporarily unavailable'
        });
    }
};

export const getTenorByID = async (req, res) => {
    try {
        validateApiConfig();

        const { id } = req.body;
        const sanitizedId = sanitizeString(id);

        if (!sanitizedId) {
            return res.status(400).json({ error: 'Invalid GIF ID' });
        }

        const cacheKey = `tenor_id_${sanitizedId}`;
        const cached = getCachedResponse(cacheKey);

        if (cached) {
            return res.status(200).json({ tenor: cached });
        }

        const params = new URLSearchParams({
            ids: sanitizedId,
            key: process.env.TENOR_API_KEY,
            limit: '1'
        });

        const response = await axios.get(
            `https://g.tenor.com/v1/gifs?${params}`,
            axiosConfig
        );

        const gifData = response.data.results[0] || null;
        setCachedResponse(cacheKey, gifData);

        res.status(200).json({ tenor: gifData });
    } catch (error) {
        console.log('Tenor GIF by ID error:', error);

        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ error: 'Request timeout' });
        }

        if (error.code == 'ERR_NOCK_NO_MATCH') {
            return res.status(200).json({ tenor: [] });
        }

        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'Unable to fetch GIF details'
        });
    }
};

export const getSVG_search = async (req, res) => {
    try {
        const { query } = req.body;
        const sanitizedQuery = sanitizeString(query);

        if (!sanitizedQuery) {
            return res.status(400).json({ error: 'Invalid search query' });
        }

        const cacheKey = `svg_search_${sanitizedQuery}`;
        const cached = getCachedResponse(cacheKey);

        if (cached) {
            return res.status(200).json({ svg: cached });
        }

        const searchList = await axios.get(
            `https://api.svgl.app?search=${sanitizedQuery}`,
            axiosConfig
        );

        setCachedResponse(cacheKey, searchList.data);

        res.status(200).json({ svg: searchList.data });
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ error: 'Request timeout' });
        }

        if (error.code == 'ERR_NOCK_NO_MATCH') {
            return res.status(200).json({ svg: [] });
        }

        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'SVG search service unavailable'
        });
    }
};

export const getSVG_code = async (req, res) => {
    try {
        const { name } = req.body;
        const sanitizedName = sanitizeString(name);

        if (!sanitizedName) {
            return res.status(400).json({ error: 'Invalid SVG name' });
        }

        if (sanitizedName.includes('..') || sanitizedName.includes('/')) {
            return res.status(400).json({ error: 'Invalid SVG name' });
        }

        const cacheKey = `svg_code_${sanitizedName}`;
        const cached = getCachedResponse(cacheKey);

        if (cached) {
            return res.status(200).json({ svg: cached });
        }

        const response = await axios.get(
            `https://api.svgl.app/svg/${sanitizedName}?no-optimize`,
            axiosConfig
        );

        setCachedResponse(cacheKey, response.data);

        res.status(200).json({ svg: response.data });
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ error: 'Request timeout' });
        }

        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'SVG not found' });
        }

        if (error.code == 'ERR_NOCK_NO_MATCH') {
            return res.status(200).json({ svg: [] });
        }

        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'Unable to fetch SVG code'
        });
    }
};

export const getPhoto_list = async (req, res) => {
    try {
        const { page } = req.body;
        const validatedPage = validateNumber(page);

        const cacheKey = `photo_list_${validatedPage}`;
        const cached = getCachedResponse(cacheKey);

        if (cached) {
            return res.status(200).json({ photo: cached });
        }

        const searchList = await axios.get(
            `https://wallhaven.cc/api/v1/search?page=${validatedPage}`,
            axiosConfig
        );

        setCachedResponse(cacheKey, searchList.data.data);

        res.status(200).json({ photo: searchList.data.data });
    } catch (error) {
        console.error('Photo list error:', error.message);

        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ error: 'Request timeout' });
        }

        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'Unable to fetch photo list'
        });
    }
};

export const getPhoto_search = async (req, res) => {
    try {
        const { query, page } = req.body;

        const cacheKey = `photo_search_${query}_${page}`;
        const cached = getCachedResponse(cacheKey);

        if (cached) {
            return res.status(200).json({ photo: cached });
        }

        const searchList = await axios.get(
            `https://wallhaven.cc/api/v1/search?q=${query}&page=${page}`,
            axiosConfig
        );

        setCachedResponse(cacheKey, searchList.data.data);
        res.status(200).json({ photo: searchList.data.data });
    } catch (error) {
        console.error('Photo search error:', error.message);

        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ error: 'Request timeout' });
        }

        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({
            error: 'Photo search service unavailable'
        });
    }
};