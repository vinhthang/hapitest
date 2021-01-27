'use strict';

require('dotenv').config();

const Hapi = require('@hapi/hapi');
const Joi = require('joi');
const redis = require('redis');
const {promisify} = require('util');
const { HealthPlugin } = require('hapi-k8s-health');

const init = async () => {

    const server = Hapi.server({
      port: process.env.PORT,
      host: process.env.HOST,
    });
	
	server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {

            return 'Hello World!';
        }
    });
	
	server.route({
		method: 'POST',
		path: '/hello/{name}',
		handler: function (request, h) {
			const {redis} = request.server.app;
			redis.set('name', request.params.name);
			return redis.getAsync('name');
		},
		options: {
			validate: {
				params: Joi.object({
					name: Joi.string().min(3).max(10)
				})
			}
		}
	});
	
	server.route({
		method: 'GET',
		path: '/hello',
		handler: async function (request, h) {
			const {redis} = request.server.app;
			return redis.getAsync('name');
		}
	});

	exports.start = async () => {
		await server.register({
			plugin: HealthPlugin,
			options: {
			  livenessProbes: {
				status: () => Promise.resolve('Yeah !')
			  },
			  readinessProbes: {
				sequelize: () => container.sequelize.authenticate()
			  }
			}
		});
	
		const redisClient = redis.createClient( {
			host: process.env.REDIS_HOST,
			port: process.env.REDIS_PORT,
			auth_pass: process.env.REDIS_PASSWORD
		  }
		);
		redisClient.lpushAsync = promisify(redisClient.lpush).bind(redisClient);
		redisClient.lrangeAsync = promisify(redisClient.lrange).bind(redisClient);
		redisClient.llenAsync = promisify(redisClient.llen).bind(redisClient);
		redisClient.lremAsync = promisify(redisClient.lrem).bind(redisClient);
		redisClient.lsetAsync = promisify(redisClient.lset).bind(redisClient);
		redisClient.getAsync = promisify(redisClient.get).bind(redisClient);

		redisClient.on("error", function (err) {
			console.error("Redis error.", err);
		});

		server.app.redis = redisClient;
		
		await server.initialize();
		await server.start();
		console.log(`Server running at: ${server.info.uri}`);
		return server;
	};
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();