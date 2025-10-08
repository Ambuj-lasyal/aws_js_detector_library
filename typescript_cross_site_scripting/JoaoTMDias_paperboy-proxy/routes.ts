import { Router } from "express";
import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from "axios";
import { ILatestNewsResponse, ISourcesResponse } from "./interfaces";

// Router
const routes = Router();
const API_URL = "https://newsapi.org/v2";

routes.get("/top-headlines", async (req, res) => {
	const URL = `${API_URL}/top-headlines`;
	const REQUEST_CONFIG: AxiosRequestConfig = {
		headers: {
			Authorization: req.headers.authorization,
		},
		params: {
			sources: req.query.sources,
		},
	}

	try {
		const { data }: AxiosResponse<ILatestNewsResponse> = await axios.get(URL, REQUEST_CONFIG);

		res.send(data);
	} catch (err) {
		const error: AxiosError = err;
		if (error.response) {
			res.status(error.response.status).send(error.response.data);
		} else {
			res.status(400).send(error.message);
		}
	}
});

routes.get("/sources", async (req, res) => {
	const URL = `${API_URL}/sources`;
	const REQUEST_CONFIG: AxiosRequestConfig = {
		headers: {
			Authorization: req.headers.authorization,
		}
	}

	try {
		const { data }: AxiosResponse<ISourcesResponse> = await axios.get(URL, REQUEST_CONFIG);

		res.send(data);
	} catch (err) {
		const error: AxiosError = err;
		if (error.response) {
			res.status(error.response.status).send(error.response.data);
		} else {
			res.status(400).send(error.message);
		}
	}
});

routes.get("/sources", async (req, res) => {
	const URL = `${API_URL}/sources`;
	const REQUEST_CONFIG: AxiosRequestConfig = {
		headers: {
			Authorization: req.headers.authorization,
		}
	}

	try {
		const { data }: AxiosResponse<ISourcesResponse> = await axios.get(URL, REQUEST_CONFIG);

		res.send(data);
	} catch (err) {
		const error: AxiosError = err;
		if (error.response) {
			res.status(error.response.status).send(error.response.data);
		} else {
			res.status(400).send(error.message);
		}
	}
});

export {
	routes
};
