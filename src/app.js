const express = require('express');
const bodyParser = require('body-parser');
const {sequelize, Profile} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
const { Op } = require("sequelize");
app.set('models', sequelize.models)

/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) =>{;
    const {Contract} = req.app.get('models')
    const {id} = req.params
    const contract = await Contract.findOne({where: {id}})
    if(!contract) return res.status(404).end()
    if (contract.ClientId !== req.profile.id && contract.ContractorId !== req.profile.id )
    return res.status(404).end("Not allowed");
    res.json(contract)
})

app.get('/contracts', getProfile, async (req, res) =>{
    const {Contract} = req.app.get('models')
    const contractsList = await Contract.findAll({where: {
        [Op.and] : [
            {status: {[Op.not]: "terminated"}},
            {
                [Op.or] : 
                [
                    {ClientId: { [Op.eq]: req.profile.id}}, 
                    {ContractorId: { [Op.eq]: req.profile.id}}
                ]
            }
        ]
    }})
    res.json(contractsList);
})


app.get('/jobs/unpaid', getProfile, async (req, res) =>{
    const {Job} = req.app.get('models')
    const {Contract} = req.app.get('models')
    const contractsIds = await Contract.findAll({attributes: ['id'], where: {
        [Op.and] : [
            {status: "active"},
            {
                [Op.or] : 
                [
                    {ClientId: { [Op.eq]: req.profile.id}}, 
                    {ContractorId: { [Op.eq]: req.profile.id}}
                ]
            }
        ]
    }})
    const parsedContractsIds = contractsIds.map((contracts) => contracts.get({ plain: true }));
    if (parsedContractsIds.length === 0)     return res.status(404).end("No jobs");
    const unpaidJobs = await Job.findAll({where:
        {
        [Op.and] : [
         {paid: false},
         {ContractId: { [Op.contains]: parsedContractsIds}}
        ]}})
    res.json(unpaidJobs);
})

app.post('/jobs/:job_id/pay', getProfile, async (req, res) =>{;
    const {Job} = req.app.get('models')
    const {Profile} = req.app.get('models')
    const {Contract} = req.app.get('models')
    const {job_id} = req.params
    const job = await Job.findOne({where: {ContractId: job_id}})
    const contract = await Contract.findOne({where: {id: job_id}})
    if (job.paid) return res.status(404).end("Already paid")
    else {
        await Job.update({ paid: true }, {
            where: {
                ContractId: job_id
            }
          });
    }
    const client = await Profile.findOne({where: {id: contract.ClientId}});
    const contractor = await Profile.findOne({where: {id: contract.ContractorId}});
    if (job.price > client.balance) return res.status(404).end("Not enough money")
    await Profile.update({ balance: { [Op.eq]: client.balance - job.price} }, {
        where: {
          id: contract.ClientId
        }
      });
    await Profile.update({ balance: { [Op.eq]: contractor.balance + job.price} }, {
        where: {
          id: contract.ContractorId
        }
      });
      
    res.json("Paid");
})


module.exports = app;
