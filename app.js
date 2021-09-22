require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const bodyParser = require('body-parser');
const { v4 } = require('uuid');
const cors = require('cors');

app.use(bodyParser.json());
app.use(cors({ origin: 'http://localhost:3000' }));

mongoose.connect(process.env.MONGO);

const userSchema = mongoose.Schema({
  name: String,
  publicKey: String,
  privateKey: String,
  coins: Number,
});

const blockedListSchema = mongoose.Schema({
  userId: String,
});

const User = mongoose.model('user', userSchema);
const BlockedList = mongoose.model('blockedList', blockedListSchema);

app.post('/balance', (req, res) => {
  const { publicKey, privateKey } = req.body;

  if (!publicKey || !privateKey) {
    res.status(206).send({
      status: 'failure',
      message: 'please porvide keys',
    });
  } else {
    User.findOne(
      { publicKey: publicKey, privateKey: privateKey },
      (err, user) => {
        if (err) {
          console.log(err);
        } else {
          if (!user) {
            res.status(404).send({
              status: 'failure',
              message: 'key pair found',
            });
          } else {
            res.status(200).send({
              status: 'success',
              coins: user.coins,
            });
          }
        }
      }
    );
  }
});

app.post('/grab', (req, res) => {
  const { privateKey } = req.body;
  if (!privateKey) {
    res
      .status(206)
      .send({ status: 'failure', message: 'Please provide private key' });
  } else {
    BlockedList.findOne({ userId: privateKey }, (err, result) => {
      if (err) {
        console.log(err);
      } else {
        if (!result) {
          const num = Math.floor(Math.random() * 3);
          if (num === 1) {
            User.findOne({ privateKey: privateKey }, (userErr, user) => {
              if (userErr) {
                console.log(userErr);
              } else {
                if (!user) {
                  res.status(400).send({
                    status: 'failure',
                    message: 'Private key not found',
                  });
                } else {
                  user.coins = user.coins + 1;
                  user.save((err) => {
                    if (err) {
                      console.log(err);
                    } else {
                      res
                        .status(200)
                        .send({ status: 'success', message: 'Coin rewarded' });
                    }
                  });
                }
              }
            });
          } else {
            res
              .status(400)
              .send({ status: 'failure', message: 'Oops!! Unlucky' });
          }
          const blockeduser = new BlockedList({
            userId: privateKey,
          });
          blockeduser.save((err) => {
            if (err) {
              console.log(err);
            }
          });
        } else {
          res
            .status(429)
            .send({ status: 'failure', message: 'Try again after some time' });
        }
      }
    });
  }
});

app.post('/new-user', (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(206).send({
      status: 'failure',
      message: 'Please provide a name',
    });
  } else {
    const user = new User({
      name: req.body.name,
      publicKey: v4(),
      privateKey: v4(),
      coins: 1,
    });
    user.save((err) => {
      if (err) {
        console.log(err);
      } else {
        res.status(200).send({
          status: 'success',
          publicKey: user.publicKey,
          privateKey: user.privateKey,
        });
      }
    });
  }
});

app.post('/transfer', (req, res) => {
  const { publicKey, privateKey, toPublicKey, amount } = req.body;
  if (!publicKey || !privateKey || !toPublicKey || !amount) {
    res.status(206).send({
      status: 'failure',
      message: 'please provide all the details',
    });
  } else {
    if (toPublicKey == publicKey) {
      res.status(400).send({
        status: 'failure',
        message: "reciver's public key and sender's public key can't be same",
      });
    } else {
      if (isNaN(Number(amount)) || amount == 0) {
        res.status(400).send({
          status: 'failure',
          message: 'please provide a vaild amount',
        });
      } else {
        User.findOne(
          { publicKey: publicKey, privateKey: privateKey },
          (err, user) => {
            if (err) {
              console.log(err);
            } else {
              // search for sender
              if (!user) {
                res.status(400).send({
                  status: 'failure',
                  message: 'no public private key pair found',
                });
              } else {
                if (user.coins < amount) {
                  res.status(206).send({
                    status: 'failure',
                    message: "you don't have enough coins to transfer",
                  });
                } else {
                  User.findOne({ publicKey: toPublicKey }, (err, result) => {
                    // search for reciver
                    if (err) {
                      console.log(err);
                    } else {
                      if (!result) {
                        res.status(400).send({
                          status: 'failure',
                          message: "reciver's public key not found",
                        });
                      } else {
                        // create the actual transfer
                        user.coins = user.coins - Number(amount);
                        user.save((err) => {
                          if (err) {
                            console.log(err);
                          } else {
                            result.coins = result.coins + Number(amount);
                            result.save((err) => {
                              if (err) {
                                console.log(err);
                              } else {
                                res.status(200).send({
                                  status: 'success',
                                  message: 'transfer successfull',
                                });
                              }
                            });
                          }
                        });
                      }
                    }
                  });
                }
              }
            }
          }
        );
      }
    }
  }
});

const unblockUsers = () => {
  BlockedList.deleteMany({}, (err) => {
    if (err) {
      console.log(err);
    }
  });
};

unblockUsers();
setInterval(unblockUsers, 2000);

app.listen(process.env.PORT || 5000);
