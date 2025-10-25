import axios from "axios";
import crypto from "crypto"

import * as dotenv from 'dotenv';

dotenv.config()

export const getPhotos = async (req, res) => {
  try {
    const { page } = req.body;

    const searchList = await axios.get(`https://boringapi.com/api/v1/photos/?limit=20&page=${page}`)
      .then((response) => {
        return response.data;
      });

    console.log('data!!!: ', searchList.photos[0])
    res.status(200).json({ photos: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getPhotoByID = async (req, res) => {
  try {
    const { photo_id } = req.body;

    const searchList = await axios.get(`https://boringapi.com/api/v1/photos/${photo_id}`)
      .then((response) => {
        return response.data;
      });

    console.log('data!!!: ', searchList)
    res.status(200).json({ photos: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getPhotosByQuery = async (req, res) => {
  try {
    const { query, page } = req.body;

    const searchList = await axios.get(`https://boringapi.com/api/v1/photos/?search=${query}&limit=20&page=${page}`)
      .then((response) => {
        return response.data;
      });

    console.log('data!!! q: ', searchList)
    res.status(200).json({ photos: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getStroyblockVideoByID = async (req, res) => {
  try {
    const { item_id } = req.body;

    const privateKey = process.env.STORYBLOCK_PRIVATE_KEY;
    const resource = `/api/v2/videos/stock-item/details/:${item_id}`;
    const hmacBuilder = crypto.createHmac('sha256', privateKey + 1791531251);
    hmacBuilder.update(resource);
    const hmac = hmacBuilder.digest('hex');


    const searchList = await axios.get(`https://api.storyblocks.com/api/v2/videos/stock-item/details/:${item_id}&APIKEY=${privateKey}&EXPIRES=${1791531251}HMAC=${hmac}`)
      .then((response) => {
        return response.data;
      });

    console.log('data!!!: ', searchList)
    res.status(200).json({ storyblock: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getStroyblockPhotoByID = async (req, res) => {
  try {
    const { item_id } = req.body;

    const privateKey = process.env.STORYBLOCK_PRIVATE_KEY;
    const resource = `/api/v2/images/stock-item/details/:${item_id}`;
    const hmacBuilder = crypto.createHmac('sha256', privateKey + 1791531251);
    hmacBuilder.update(resource);
    const hmac = hmacBuilder.digest('hex');


    const searchList = await axios.get(`https://api.storyblocks.com/api/v2/images/stock-item/details/:${item_id}&APIKEY=${privateKey}&EXPIRES=${1791531251}HMAC=${hmac}`)
      .then((response) => {
        return response.data;
      });

    console.log('data!!!: ', searchList)
    res.status(200).json({ storyblock: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getStroyblockPhotosByQuery = async (req, res) => {
  try {
    const publicKey = process.env.STORYBLOCK_PUBLIC_KEY;
    const privateKey = process.env.STORYBLOCK_PRIVATE_KEY;

    const credentials = Buffer.from(`${publicKey}:${privateKey}`).toString('base64');

    const { query, page } = req.body;

    const searchList = await axios.get(`https://api.storyblocks.com/api/v2/images/search?results_per_page=20&keywords=${query}&page=${page}&project_id=587a504747f81a2ceae38b2244f92e127d42709f1f9af9b74a074817b949bdbc&user_id=587a504747f81a2ceae38b2244f92e127d42709f1f9af9b74a074817b949bdb1`, { headers: { 'Authorization': `Basic ${credentials}` } })
      .then((response) => {
        return response.data;
      });

    console.log('data!!!PHOTO')
    res.status(200).json({ storyblock: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getStroyblockVideosByQuery = async (req, res) => {
  try {
    const publicKey = process.env.STORYBLOCK_PUBLIC_KEY;
    const privateKey = process.env.STORYBLOCK_PRIVATE_KEY;

    const credentials = Buffer.from(`${publicKey}:${privateKey}`).toString('base64');

    const { query, page } = req.body;

    const searchList = await axios.get(`https://api.storyblocks.com/api/v2/videos/search?results_per_page=20&keywords=${query}&page=${page}&project_id=587a504747f81a2ceae38b2244f92e127d42709f1f9af9b74a074817b949bdbc&user_id=587a504747f81a2ceae38b2244f92e127d42709f1f9af9b74a074817b949bdb1`, { headers: { 'Authorization': `Basic ${credentials}` } })
      .then((response) => {
        return response.data;
      });

    console.log('data!!! stroqVID')
    res.status(200).json({ storyblock: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getTenorTrendings = async (req, res) => {
  try {
    const { next } = req.body;
    const url = next ? `https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=20&pos=${next}` : 'https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=20'

    const searchList = await axios.get(url)
      .then((response) => {
        console.log('data tenor: ', response.data)

        return response.data;
      });

    console.log('data tenor')
    res.status(200).json({ tenor: searchList });
  } catch (e) {
    // console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getTenorSearch = async (req, res) => {
  try {
    const { page, query } = req.body;

    const url = `https://g.tenor.com/v1/search?q=${query}&key=LIVDSRZULELA&limit=20&pos=${page * 20}`

    const searchList = await axios.get(url)
      .then((response) => {
        return response.data.results;
      });

    console.log('data tenor')
    res.status(200).json({ tenor: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}