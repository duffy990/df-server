//要创建一个服务器
let config = require('./config');
let http = require('http');
let chalk = require('chalk');
let path = require('path');
let url = require('url');
let fs = require('fs');
let mime = require('mime');
let { promisify } = require('util');
let handlebars = require('handlebars'); //模板
let stat = promisify(fs.stat);
let readdir = promisify(fs.readdir);

//在代码内部是可以读到环境变量的值，当然也可以写入环境变量的值
//console.log(process.env);
//process.env.DEBUG = 'static:*';
//console.log(process.env);
//这是一个在控制台输出的模块,名称有特点有二部分组成，第一部分一般是项目名，第二模分是模块名
//每个debug实例都有一个名字，是否在控制台打印取决于环境变量中DEBUG的值是否等于static:app
let debug = require('debug')('static:app');
//编译模板，得到一个渲染的方法,然后传入实际数据数据就可以得到渲染后的HTML了
function list() {
    let tmpl = fs.readFileSync(path.resolve(__dirname, 'template', 'list.html'), 'utf8');
    return handlebars.compile(tmpl);
}
class Server {
    constructor(argv) {
        this.list = list();
        this.config = Object.assign({}, this.config, argv);
    }
    start() {
        let server = http.createServer();
        server.on('request', this.request.bind(this));
        server.listen(this.config.port, () => {
            let url = `http://${this.config.host}:${this.config.port}`;
            debug(`server started at ${chalk.green(url)}`);
        });
    }
    async request(req, res) {
        let { pathname } = url.parse(req.url)
        let filepath = path.join(this.config.root, pathname);
        try {
            let statObj = await stat(filepath);
            if (statObj.isDirectory()) {//如果是目录的话，应该显示目录 下面的文件列表
                let files = await readdir(filepath);
                files = files.map(file => ({
                    name: file,
                    url: path.join(pathname, file)
                }));
                let html = this.list({
                    title: pathname,
                    files
                });
                res.setHeader('Content-Type', 'text/html');
                res.end(html);
            } else {
                this.sendFile(req, res, filepath, statObj);
            }
        } catch (e) {
            this.sendError(e, req, res)
        }

    }
    sendFile(req, res, filepath, statObj) {
        res.setHeader('Content-Type', mime.getType(filepath) + ';charset=utf-8');
        fs.createReadStream(filepath).pipe(res);
        // let encoding = this.getEncoding(req, res);
        // // let rs = this.getStream(req, res, filepath, statObj);

        // if (encoding) {
        //     fs.createReadStream(filepath).pipe(this.getEncoding).pipe(res);
        // } else {
        //     fs.createReadStream(filepath).pipe(res);
        // }
    }
    sendError(err, req, res) {
        res.statusCode = 500;
        res.end(`${err.toString()}`);
    }
    getEncoding(req, res) { // 根据浏览器返回使用不同的压缩方法
        //Accept-Encoding:gzip, deflate
        let acceptEncoding = req.headers['accept-encoding'];
        if (/\bgzip\b/.test(acceptEncoding)) {
            res.setHeader('Content-Encoding', 'gzip');
            return zlib.createGzip();
        } else if (/\bdeflate\b/.test(acceptEncoding)) {
            res.setHeader('Content-Encoding', 'deflate');
            return zlib.createDeflate();
        } else {
            return null;
        }
    }
}

module.exports = Server
// let server = new Server();
// server.start()