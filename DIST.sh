#
#   DIST.sh
#
#   David Janes
#   IOTDB
#   2015-07-23
#

PACKAGE=iotdb-recipes
DIST_ROOT=/var/tmp/.dist.$$

if [ ! -d "$DIST_ROOT" ]
then
    mkdir "$DIST_ROOT"
fi

echo "=================="
echo "NPM Packge: $PACKAGE"
echo "=================="
(
    NPM_DST="$DIST_ROOT/$PACKAGE"
    echo "NPM_DST=$NPM_DST"

    if [ -d ${NPM_DST} ]
    then
        rm -rf "${NPM_DST}"
    fi
    mkdir "${NPM_DST}" || exit 1

    update-package --increment-version --package "$PACKAGE" --homestar || exit 1

    tar cf - \
        --exclude "node_modules" \
        --exclude ".*" \
        README.md LICENSE \
        homestar.json package.json \
        RecipeTransport.js index.js recipe.js \
        |
    ( cd "${NPM_DST}" && tar xvf - )

    cd "${NPM_DST}" || exit 1
    npm publish

    echo "end"
)
