import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  CurrentBakeryId,
  RequireBakeryContext,
} from '../auth/auth.decorators.js';
import {
  CreateProductDto,
  CreateRecipeVersionDto,
  ListProductsQueryDto,
  PublishRecipeVersionDto,
  ReplaceRecipeMaterialsDto,
  UpdateProductDto,
  UpdateRecipeVersionDto,
} from './products.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
@RequireBakeryContext('ADMIN', 'EDITOR', 'VIEWER')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(
    @CurrentBakeryId() bakeryId: string,
    @Query() query: ListProductsQueryDto,
  ) {
    return this.productsService.listProducts(bakeryId, query);
  }

  @Post()
  @RequireBakeryContext('ADMIN', 'EDITOR')
  create(
    @CurrentBakeryId() bakeryId: string,
    @Body() input: CreateProductDto,
  ) {
    return this.productsService.createProduct(bakeryId, input);
  }

  @Get(':productId/recipe-versions/:versionId')
  getRecipeVersion(
    @CurrentBakeryId() bakeryId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.productsService.getRecipeVersion(
      bakeryId,
      productId,
      versionId,
    );
  }

  @Patch(':productId/recipe-versions/:versionId')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  updateRecipeVersion(
    @CurrentBakeryId() bakeryId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() input: UpdateRecipeVersionDto,
  ) {
    return this.productsService.updateRecipeVersion(
      bakeryId,
      productId,
      versionId,
      input,
    );
  }

  @Put(':productId/recipe-versions/:versionId/materials')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  replaceRecipeMaterials(
    @CurrentBakeryId() bakeryId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() input: ReplaceRecipeMaterialsDto,
  ) {
    return this.productsService.replaceRecipeMaterials(
      bakeryId,
      productId,
      versionId,
      input.items,
    );
  }

  @Post(':productId/recipe-versions/:versionId/publish')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  publishRecipeVersion(
    @CurrentBakeryId() bakeryId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() input: PublishRecipeVersionDto,
  ) {
    return this.productsService.publishRecipeVersion(
      bakeryId,
      productId,
      versionId,
      input,
    );
  }

  @Get(':productId/recipe-versions')
  listRecipeVersions(
    @CurrentBakeryId() bakeryId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.productsService.listRecipeVersions(bakeryId, productId);
  }

  @Post(':productId/recipe-versions')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  createRecipeVersion(
    @CurrentBakeryId() bakeryId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() input: CreateRecipeVersionDto,
  ) {
    return this.productsService.createRecipeVersion(
      bakeryId,
      productId,
      input,
    );
  }

  @Get(':productId')
  getProduct(
    @CurrentBakeryId() bakeryId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.productsService.getProduct(bakeryId, productId);
  }

  @Patch(':productId')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  updateProduct(
    @CurrentBakeryId() bakeryId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(bakeryId, productId, input);
  }
}
