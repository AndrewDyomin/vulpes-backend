const { default: axios } = require("axios");

const baseUrl = 'https://api.novaposhta.ua/v2.0/json/';
const key = process.env.NP_API_KEY;

async function getCities(req, res) {
    const { value } = req.params;
    try {
        const response = await axios.post(baseUrl, {
            "apiKey": key,
            "modelName": "AddressGeneral",
            "calledMethod": "getCities",
            "methodProperties": {
                "FindByString": value,
            }
        })
        
        res.status(200).send( response?.data?.data );
    } catch(err) {
        console.log(err)
        res.status(500).send({ message: "Something went wrong." });
    }
}

async function getBranches(req, res) {
    const { ref, value } = req.params;
    try {
        const response = await axios.post(baseUrl, {
            "apiKey": key,
            "modelName": "AddressGeneral",
            "calledMethod": "getWarehouses",
            "methodProperties": {
                "FindByString" :  value !== 'null' ? value : "",
                "CityRef" : ref,
            },
        })
        res.status(200).send( response?.data?.data );
    } catch(err) {
        console.log(err)
        res.status(500).send({ message: "Something went wrong." });
    }
}

module.exports = {
    getCities,
    getBranches,
};