const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    // DB migration creates users.role with default 'user' — keep model aligned
    defaultValue: 'user'
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reputation: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
});

//хук, который вызовается до того, как user будет создан
User.beforeCreate(async (user) => {
  user.password = await bcrypt.hash(user.password, 12);
});

User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

console.log('✅ User model определена, findOne type:', typeof User.findOne);

module.exports = User;