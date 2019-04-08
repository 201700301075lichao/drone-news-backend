var mysql = require('mysql');
var express = require('express');

var app = express();

var con = mysql.createConnection({
    host: "mysql",
    user: "root",
    password: "123456",
    database: "news"
});

function get_news(callback) {
    var superagent = require('superagent');
    var cheerio = require('cheerio');
    var eventproxy = require('eventproxy')
    var app = express();
    topicUrls = [];
    superagent.get('https://www.81uav.cn/uav-news/')
        .end(function (err, sres) {
            if (err) {
                console.log(err);
                return;
            }
            var $ = cheerio.load(sres.text);
            $('.news-list-box ul li').each(function (idx, element) {
                var $element = $(element);
                topicUrls.push({
                    title: $element.find('img').attr('alt'),
                    imgUrl: $element.find('img').attr('src'),
                    href: $element.children('a').attr('href'),
                    digest: $element.find('p').text().trim(),
                    tag: $element.find('i a').text().trim(),
                    date: $element.find('em').text().trim()
                })
            });
            // console.log('topicUrls:', topicUrls);
            topicUrls.forEach(function (topicUrl) {
                superagent.get(topicUrl.href)
                    .end(function (err, res) {
                        console.log('fetch' + topicUrl.href + 'successful');
                        ep.emit('topic_html', [topicUrl, res.text]);
                    });
            });

            var ep = new eventproxy();

            ep.after('topic_html', topicUrls.length, function (topics) {
                console.log("ep.after goes", topics);
                topics = topics.map(function (topicPair) {
                    var topicInfo = topicPair[0];
                    var topicHtml = topicPair[1];
                    var $ = cheerio.load(topicHtml);
                    var info = $('.info').text().trim();
                    info = info.slice(0, info.length - 8);
                    var re = /.*来源：(.*)作者：(.*)/g;
                    var res = re.exec(info);
                    var author = '';
                    var source = '';
                    if (res) {
                        source = res[1].trim();
                        author = res[2].trim();
                    } else {
                        var re1 = /.*作者：(.*)/g;
                        var re2 = /.*来源：(.*)/g;
                        var res1 = re1.exec(info);
                        var res2 = re2.exec(info);
                        if (res1) author = res1[1].trim();
                        if (res2) source = res2[1].trim();
                    }
                    var items = $('#content').html();
                    body = items //这里就是请求后获得的返回数据，或者那些 .html()后获取的

                    //一般可以先转换为标准unicode格式（有需要就添加：当返回的数据呈现太多\\\u 之类的时）
                    body = unescape(body.replace(/\\u/g, "%u"));
                    //再对实体符进行转义
                    //有x则表示是16进制，$1就是匹配是否有x ，$2就是匹配出的第二个括号捕获到的内容，将$2以对应进制表示转换
                    body = body.replace(/&#(x)?(\w+);/g, function ($, $1, $2) {
                        return String.fromCharCode(parseInt($2, $1 ? 16 : 10));
                    });
                    topicInfo.content = body;
                    topicInfo.author = author;
                    topicInfo.source = source;
                    console.log("topicinfo:", topicInfo);
                    return (topicInfo);
                });
                // console.log('final:');
                // console.log(topics);
                insertData(con, topics, function (err, options) {
                    if (err) {
                        console.log("insertData error", err);
                    } else {
                        callback(err, options);
                    }
                });
            });
        });
};

// get_news();

app.get('/', function (req, res) {
    selectData(con, function (err, result) {
        if (err) {
            res.send("please try visit 'http://your-url/createTable' first,if fail again,please contact me.");
            console.log('get error', err);
        } else {
            console.log(result);
            res.send(result);
        };
    });
});

app.get('/createTable', function (req, res) {
    createTable(con, function (err, options) {
        if (err) {
            res.send("createTable error");
            console.log("createTable error", err);
        } else res.send("createTable succsee!", "count", options);
    });
});
app.get('/deleteData', function (req,res) {
    deleteData(con,function(err){
        if (err) {
            res.send('deleteData error');
            console.log('deleteData error', err);
        }
        else {
            res.send("deleteData success!");
        }
    });
})

app.listen(3000, function () {
    console.log("server is running on port 3000");
});


// insertData(con,news);
// selectData(con,function(err,result){
//     console.log(result);
// });
// deleteData(con);
// createTable(con);

function createTable(con, callback) {
    console.log("CreateTable Connected!");
    var sql = "create table articles (id int not null auto_increment,title varchar(100) not null,author varchar(40),imgUrl varchar(100) not null,source varchar(40),tag varchar(40),date varchar(20),digest varchar(200) not null,content longtext not null,primary key(id))engine=innodb,default charset=utf8;"
    con.query(sql, function (err, result) {
        console.log("create table success!");
        console.log(result);
        get_news(function (err, options) {
            if (err) {
                console.log("get_news error", err);
            }
            callback(err, options);
        });
    });
}

/**插入数据 */
function insertData(con, news, callback) {
    var count = 0;
    console.log("Connected!");
    news.forEach(function (article) {
        var sql = "INSERT INTO articles (title,author,imgUrl,tag,date,source,digest,content) VALUES (?,?,?,?,?,?,?,?)";
        var params = [article.title, article.author, article.imgUrl, article.tag, article.date, article.source, article.digest, article.content];
        con.query(sql, params, function (err, result) {
            if (err) throw err;
            console.log("1 record inserted");
            count++;
            if (count === news.length) {
                console.log("total success", count);
                callback(err, count);
            };
        });
    });
};

/**查询数据 */
function selectData(con, callback) {
    console.log("SelectData Connected!");
    var sql = "SELECT * FROM articles";
    con.query(sql, function (err, result) {
        callback(err, result);
    });
}
/** 删除数据*/
function deleteData(con, callback) {
    console.log("Connected!");
    var sql = "DELETE FROM articles ";
    con.query(sql, function (err, result) {
        if (err)callback(err);
        console.log("delete success");
        callback();
    });
}