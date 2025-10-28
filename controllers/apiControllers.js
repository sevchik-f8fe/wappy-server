import axios from "axios";

import * as dotenv from 'dotenv';

dotenv.config()

export const getTenorTrendings = async (req, res) => {
  try {
    const { next } = req.body;
    const url = next ? `https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=30&pos=${next}` : 'https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=30'

    const searchList = await axios.get(url)
      .then((response) => {
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

    const url = `https://g.tenor.com/v1/search?q=${query}&key=LIVDSRZULELA&limit=30&pos=${page * 20}`

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

export const getTenorByID = async (req, res) => {
  try {
    const { id } = req.body;

    const searchList = await axios.get(`https://g.tenor.com/v1/gifs?ids=${id}&key=LIVDSRZULELA&limit=1`)
      .then(res => res.data.results[0]);

    console.log('data t id');
    res.status(200).json({ tenor: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getSVG_search = async (req, res) => {
  try {
    const { query } = req.body;

    const searchList = await axios.get(`https://api.svgl.app?search=${query}`)
      .then(res => res.data);

    console.log('data svg search');
    res.status(200).json({ svg: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getSVG_code = async (req, res) => {
  try {
    //https://api.svgl.app/svg/adobe.svg?no-optimize
    const { name } = req.body;

    const searchList = await axios.get(`https://api.svgl.app/svg/${name}?no-optimize`)
      .then(res => res.data);

    console.log('data svg search');
    res.status(200).json({ svg: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getPhoto_list = async (req, res) => {
  try {
    const { page } = req.body;

    const searchList = await axios.get(`https://wallhaven.cc/api/v1/search?page=${page}`)
      .then(res => res.data.data);

    console.log('data photo list');
    res.status(200).json({ photo: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}

export const getPhoto_search = async (req, res) => {
  try {
    const { query, page } = req.body;

    const searchList = await axios.get(`https://wallhaven.cc/api/v1/search?q=${query}&page=${page}`)
      .then(res => res.data.data);

    console.log('data photo list');
    res.status(200).json({ photo: searchList });
  } catch (e) {
    console.log('err: ', e)
    res.status(500).json({ error: 'Ошибка' });
  }
}