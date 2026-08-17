const Nodes = require("../models/knowledgeNodes");

async function getAllNodes(req, res) {
  try {
    const nodes = await Nodes.find().exec();
    res.status(200).send(nodes);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Something went wrong" });
  }
}

async function updateNode(req, res) {
  const node = req.body;
  try {
    if (node?._id) {
      await Nodes.findByIdAndUpdate(node._id, node);
      res.status(200).send({ message: "Node updated" });
    } else {
      await Nodes.create(node);
      res.status(200).send({ message: "Node created" });
    }
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .send({ message: "Something went wrong. Please, try again later" });
  }
}

async function addChild(req, res) {
  const node = req.body;
  try {
    if (!node._id) {
      throw new Error("node._id is required");
    }

    await Nodes.create({ parentIds: [`${node._id}`] });
    res.status(200).send({ message: "Node created" });
  } catch (err) {
    console.log(err);
    res.status(200).send({ message: "Something went wrong" });
  }
}

async function addBetween(req, res) {
  try {
    const { parentId, childId } = req.body;
    if (!parentId || !childId) {
      throw new Error("parentId and childId are required both");
    }

    const newNode = await Nodes.create({ parentIds: [`${parentId}`] });
    await Nodes.findOneAndUpdate(
      {
        _id: childId,
        parentIds: parentId,
      },
      {
        $set: {
          "parentIds.$": String(newNode._id),
        },
      },
    );

    res.status(200).send({ message: "Node created" });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: err });
  }
}

async function delNode(req, res) {
  const node = req.body;
  try {
    if (!node?._id) {
      throw new Error("Node info is required");
    }

    const children = await Nodes.find({
      parentIds: String(node._id),
    });

    for (const child of children) {
      const newParentIds = [
        ...new Set([
          ...child.parentIds.filter((id) => String(id) !== String(node._id)),
          ...node.parentIds.map(i => String(i)),
        ]),
      ];

      await Nodes.findByIdAndUpdate(child._id, {
          parentIds: newParentIds,
      });
    }

    await Nodes.findByIdAndDelete(node._id);

    res.status(200).send({ message: "Node deleted" });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: err });
  }
}

async function addLink(req, res) {
  const { parentId, parentIds, childId } = req.body;
  
  try {
    if (!parentId || !parentIds || !childId) {
      throw new Error('parentId, parentIds, childId - required!');
    }

    await Nodes.findByIdAndUpdate(childId, { parentIds: [ ...parentIds, parentId ] });
    res.status(200).send({ message: "+ link" });
  } catch(err) {
    console.log(err);
    res.status(500).send({ message: "Something went wrong" });
  }
}

module.exports = {
  getAllNodes,
  updateNode,
  addChild,
  addBetween,
  delNode,
  addLink,
};
