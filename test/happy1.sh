

node echo.js 12000 --seneca.log=plugin:heart > echo-0.log &
node echo.js 12001 --seneca.log=plugin:heart > echo-1.log &
node echo.js 12002 --seneca.log=plugin:heart > echo-2.log &

sleep 1

node main.js --seneca.log=plugin:heart > main.log &
#node main.js --seneca.log.all > main.log &

sleep 1

curl "http://localhost:10101/act?role=heart&cmd=add-node&id=12000&port=12000"
curl "http://localhost:10101/act?role=heart&cmd=add-node&id=12001&port=12001"
curl "http://localhost:10101/act?role=heart&cmd=add-node&id=12002&port=12002"
   




 
