let globalContext = {
    subtopicId: null,
    description: null,
  };
  
  module.exports.getSubtopicId = function() {
    return globalContext.subtopicId;
  };
  
  module.exports.updateSubtopicId = function(newSubtopicId) {
    globalContext.subtopicId = newSubtopicId;
  };
  module.exports.getDescription = function() {
    return globalContext.description;
  };
  module.exports.updateDescription = function(newDescription) {
    globalContext.description = newDescription;
  };
  module.exports.clearContext = function() {
    globalContext.subtopicId = null;
    globalContext.description = null;
  };